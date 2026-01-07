import { useCallback, useRef, useState } from "react";

/**
 * DEBUG:
 * - Ligue com: localStorage.setItem("AGENDA_GROUP_DEBUG","1")
 * - Desligue:   localStorage.removeItem("AGENDA_GROUP_DEBUG")
 */
function dbgEnabled() {
  try {
    return localStorage.getItem("AGENDA_GROUP_DEBUG") === "1";
  } catch {
    return false;
  }
}
function dbg(...args) {
  if (!dbgEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug("[useGroupEmployees]", ...args);
}

function norm(v) {
  return String(v ?? "").trim().toUpperCase();
}

function uniq(arr) {
  const out = [];
  const set = new Set();
  for (const x of arr || []) {
    const k = norm(x);
    if (!k) continue;
    if (set.has(k)) continue;
    set.add(k);
    out.push(k);
  }
  return out;
}

function sortByNome(list) {
  return (list || [])
    .slice()
    .sort((a, b) =>
      String(a?.Nome || "").localeCompare(String(b?.Nome || ""), "pt-BR")
    );
}

function dedupeByChave(list) {
  const m = new Map();
  for (const e of list || []) {
    const k = norm(e?.Chave);
    if (!k) continue;
    if (!m.has(k)) m.set(k, e);
  }
  return Array.from(m.values());
}

/**
 * Fallback de hierarquia por função (caso algum registro venha sem Hierarquia do backend)
 * Você passou estas regras.
 */
const FALLBACK_PARENT_BY_ROLE = {
  TMA: "SUEIN",
  TMI: "SUEIN",
  TME: "SUEIN",
  TMM: "SUMEC",
  TO_P: "SUPROD",
  TO_E: "SUEMB",
  TLT: "SUEMB",

  SUEIN: "COMAN",
  SUMEC: "COMAN",
  SUPROD: "COPROD",
  SUEMB: "COEMB",

  COEMB: "GEPLAT",
  COPROD: "GEPLAT",
  COMAN: "GEPLAT",

  ENG: "GEOP",
  ADM: "GEOP",
  GEPLAT: "GEOP",
};

function getParentRole(employee) {
  // prioridade: coluna Hierarquia do banco
  const db = norm(employee?.Hierarquia);
  if (db) return db;

  // fallback por Funcao (se vier sem Hierarquia por algum motivo)
  const role = norm(employee?.Funcao);
  return FALLBACK_PARENT_BY_ROLE[role] || "";
}

function toEmployeeRow(f) {
  const chave = norm(f?.Chave);
  if (!chave) return null;

  return {
    Chave: chave,
    Nome: String(f?.Nome ?? "(sem nome)").trim() || "(sem nome)",
    Matricula: String(f?.Matricula ?? "").trim(),
    Funcao: norm(f?.Funcao),
    Hierarquia: norm(f?.Hierarquia),
    Ativo: !!f?.Ativo,
  };
}

/**
 * Monta índice de árvore de FUNÇÕES (não pessoas):
 * parentRole -> Set(childRole)
 */
function buildRoleGraph(allEmployees) {
  const childrenByParent = new Map();

  const addEdge = (parent, child) => {
    const p = norm(parent);
    const c = norm(child);
    if (!p || !c || p === c) return;
    if (!childrenByParent.has(p)) childrenByParent.set(p, new Set());
    childrenByParent.get(p).add(c);
  };

  // vindo do banco: Hierarquia (parent) -> Funcao (child)
  for (const e of allEmployees || []) {
    const role = norm(e?.Funcao);
    const parent = getParentRole(e);
    if (role && parent) addEdge(parent, role);
  }

  // injeta fallback (garante árvore mesmo se vier algum registro sem Hierarquia)
  for (const [child, parent] of Object.entries(FALLBACK_PARENT_BY_ROLE)) {
    addEdge(parent, child);
  }

  return childrenByParent;
}

/**
 * DFS para pegar descendentes de uma seed role
 * Inclui a própria seed.
 */
function collectDescendants(childrenByParent, seedRole) {
  const seed = norm(seedRole);
  const out = new Set();
  if (!seed) return out;

  const stack = [seed];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || out.has(cur)) continue;
    out.add(cur);

    const kids = childrenByParent.get(cur);
    if (kids && kids.size) {
      for (const k of kids) {
        if (!out.has(k)) stack.push(k);
      }
    }
  }

  return out;
}

/**
 * Hook:
 * - groupPlan(groupName) pode existir (seu App.jsx já tem)
 * - Sem /api/hierarquia.
 * - A hierarquia vem de dbo.Funcionarios.Hierarquia (por função).
 */
export function useGroupEmployees({ apiGet, groupPlan }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupEmployees, setGroupEmployees] = useState(null); // null = modo normal
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");

  // cache local dos funcionários (para não bater toda hora)
  const allEmployeesRef = useRef(null);
  const allLoadedOnceRef = useRef(false);

  const ensureAllEmployeesLoaded = useCallback(
    async ({ force = false } = {}) => {
      if (!force && allLoadedOnceRef.current && Array.isArray(allEmployeesRef.current)) {
        return allEmployeesRef.current;
      }

      const url = `/api/funcionarios?ativo=1&limit=5000`;
      dbg("FETCH_ALL start", { url, force });

      const raw = await apiGet(url);

      const list = Array.isArray(raw) ? raw : [];
      const mapped = dedupeByChave(list.map(toEmployeeRow).filter(Boolean));

      allEmployeesRef.current = mapped;
      allLoadedOnceRef.current = true;

      dbg("FETCH_ALL ok", { url, received: list.length, mapped: mapped.length });

      return mapped;
    },
    [apiGet]
  );

  const resetCache = useCallback(() => {
    allEmployeesRef.current = null;
    allLoadedOnceRef.current = false;
    dbg("CACHE reset");
  }, []);

  const pickGroup = useCallback(
    async (groupName, opts = {}) => {
      const clicked = String(groupName ?? "");
      const normalized = norm(clicked);

      dbg("pickGroup()", { clicked, normalized, opts });

      // voltar ao modo normal
      if (!normalized || normalized === "__ALL__" || normalized === "TODOS") {
        setActiveGroup(null);
        setGroupEmployees(null);
        setGroupError("");
        setGroupLoading(false);
        dbg("activeGroup=null => modo normal");
        return;
      }

      setActiveGroup(normalized);

      // limpa imediatamente (UI responde rápido)
      setGroupEmployees([]);
      setGroupError("");
      setGroupLoading(true);

      try {
        const all = await ensureAllEmployeesLoaded({ force: !!opts.forceReload });

        // plano (opcional) vindo do App.jsx
        const plan = groupPlan?.(normalized) || { baseGroups: [], roleIncludes: [] };

        const baseGroups = Array.isArray(plan.baseGroups) ? plan.baseGroups : [];
        const roleIncludes = Array.isArray(plan.roleIncludes) ? plan.roleIncludes : [];

        // seeds/targets: sempre inclui o próprio grupo clicado + o plano
        const targets = uniq([normalized, ...baseGroups, ...roleIncludes]);

        const graph = buildRoleGraph(all);

        // conjunto final de funções permitidas (descendentes de todas as targets)
        const allowedRoles = new Set();
        for (const t of targets) {
          const sub = collectDescendants(graph, t);
          for (const r of sub) allowedRoles.add(r);
        }

        // filtra funcionários pelo Funcao ∈ allowedRoles
        const result = all.filter((e) => allowedRoles.has(norm(e?.Funcao)));

        const finalList = sortByNome(dedupeByChave(result));

        dbg("compute", {
          activeGroup: normalized,
          plan: { baseGroups: uniq(baseGroups), roleIncludes: uniq(roleIncludes) },
          targets,
          graphParents: graph.size,
          allowedRolesCount: allowedRoles.size,
          totalAll: all.length,
          resultCount: finalList.length,
        });

        // opcional: logar as roles (pra debug pesado)
        if (dbgEnabled()) {
          dbg("allowedRoles", Array.from(allowedRoles).sort());
        }

        setGroupEmployees(finalList);

        if (!finalList.length) {
          setGroupError(
            `Grupo ${normalized}: result=0. Verifique se /api/funcionarios está retornando Funcao/Hierarquia e se dbo.Funcionarios.Hierarquia está preenchida.`
          );
          dbg("result=0 => verifique Funcionarios.Hierarquia / retorno do endpoint");
        }
      } catch (e) {
        const msg = `Falha ao carregar grupo ${normalized}: ${e?.message ?? String(e)}`;
        setGroupEmployees([]);
        setGroupError(msg);
        dbg("ERROR", { group: normalized, msg, err: String(e?.message ?? e) });
      } finally {
        setGroupLoading(false);
      }
    },
    [ensureAllEmployeesLoaded, groupPlan]
  );

  return {
    activeGroup,
    groupEmployees,
    groupLoading,
    groupError,
    pickGroup,

    // utilidades opcionais (não quebram nada se não usar)
    resetCache,
    ensureAllEmployeesLoaded,
  };
}
