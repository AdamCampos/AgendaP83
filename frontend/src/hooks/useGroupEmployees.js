import { useCallback, useState } from "react";

function dedupeEmployeesByChave(list) {
  const m = new Map();
  for (const e of list || []) {
    const k = String(e?.Chave ?? "").trim();
    if (!k) continue;
    if (!m.has(k)) m.set(k, e);
  }
  return Array.from(m.values());
}

function sortByNome(list) {
  return (list || []).slice().sort((a, b) => String(a.Nome).localeCompare(String(b.Nome), "pt-BR"));
}

function toEmployeeFromFuncionario(f) {
  const chave = String(f?.Chave ?? "").trim();
  if (!chave) return null;
  return {
    Chave: chave,
    Nome: String(f?.Nome ?? "(sem nome)").trim() || "(sem nome)",
    Matricula: String(f?.Matricula ?? "").trim(),
    Funcao: String(f?.Funcao ?? "").trim(),
  };
}

function toEmployeeFromHierarchyRow(r, funcionariosByKey) {
  const chave = String(r?.SubordinadoChave ?? "").trim();
  if (!chave) return null;
  const f = funcionariosByKey?.get(chave);
  return {
    Chave: chave,
    Nome: String(f?.Nome ?? r?.NomeSubordinado ?? "(sem nome)").trim() || "(sem nome)",
    Matricula: String(f?.Matricula ?? "").trim(),
    Funcao: String(f?.Funcao ?? "").trim(),
  };
}

function dedupeBySubordinadoChave(rows) {
  const m = new Map();
  for (const r of rows || []) {
    const k = String(r?.SubordinadoChave ?? "").trim();
    if (!k) continue;
    if (!m.has(k)) m.set(k, r);
  }
  return Array.from(m.values());
}

/**
 * Hook para "modo grupo".
 *
 * Config:
 * - fallbackSupervisorsByGroup: { SUEIN:[...], SUMEC:[...], ... }  // chaves de supervisores
 * - groupPlan: (groupName) => { baseGroups: [], roleIncludes: [] }
 *
 * Regras:
 * - baseGroups: para cada baseGroup, inclui:
 *    - os supervisores (Funcao = baseGroup) + seus subordinados via /api/hierarquia
 * - roleIncludes: inclui diretamente funcionários por Funcao (ex: COMAN, GEOP, ADM, etc)
 */
export function useGroupEmployees({
  apiGet,
  funcionariosByKey,
  fallbackSupervisorsByGroup,
  groupPlan,
}) {
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupEmployees, setGroupEmployees] = useState(null); // null = modo normal
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");

  const fetchFuncionariosByFuncao = useCallback(
    async (funcao) => {
      // tenta endpoint por funcao (se existir)
      try {
        const list = await apiGet(
          `/api/funcionarios?funcao=${encodeURIComponent(funcao)}&ativo=1&limit=2000`
        );
        return Array.isArray(list) ? list : [];
      } catch {
        // fallback: se endpoint não existir, não inventa
        return [];
      }
    },
    [apiGet]
  );

  const getSupervisorsForBaseGroup = useCallback(
    async (baseGroup) => {
      // 1) tenta buscar supervisores por funcao (ideal)
      const byFuncao = await fetchFuncionariosByFuncao(baseGroup);
      const keysFromApi = byFuncao
        .map((f) => String(f?.Chave ?? "").trim())
        .filter(Boolean);

      if (keysFromApi.length) return { keys: keysFromApi, full: byFuncao };

      // 2) fallback local (chaves vindas do seu SQL)
      const fb = (fallbackSupervisorsByGroup?.[baseGroup] || []).map((x) => String(x).trim()).filter(Boolean);
      return { keys: fb, full: [] };
    },
    [fetchFuncionariosByFuncao, fallbackSupervisorsByGroup]
  );

  const fetchHierarchyForSupervisor = useCallback(
    async (chave) => {
      const k = String(chave || "").trim();
      if (k.length !== 4) return [];
      try {
        const rows = await apiGet(`/api/hierarquia?funcionarioChave=${encodeURIComponent(k)}`);
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    },
    [apiGet]
  );

  const loadBaseGroup = useCallback(
    async (baseGroup) => {
      // inclui supervisores + subordinados
      const { keys: supervisorKeys, full: supervisorsFromApi } = await getSupervisorsForBaseGroup(baseGroup);

      // Supervisores (prioriza dados do endpoint; senão tenta cache; senão placeholder)
      const supList = [];

      if (supervisorsFromApi.length) {
        for (const f of supervisorsFromApi) {
          const e = toEmployeeFromFuncionario(f);
          if (e) supList.push(e);
        }
      } else {
        for (const k of supervisorKeys) {
          const f = funcionariosByKey?.get(k);
          supList.push({
            Chave: k,
            Nome: String(f?.Nome ?? "(sem nome)").trim() || "(sem nome)",
            Matricula: String(f?.Matricula ?? "").trim(),
            Funcao: String(f?.Funcao ?? baseGroup).trim(), // garante função
          });
        }
      }

      // Subordinados
      const allRows = [];
      for (const sup of supervisorKeys) {
        const rows = await fetchHierarchyForSupervisor(sup);
        for (const r of rows) allRows.push(r);
      }
      const uniqueRows = dedupeBySubordinadoChave(allRows);

      const subList = [];
      for (const r of uniqueRows) {
        const e = toEmployeeFromHierarchyRow(r, funcionariosByKey);
        if (e) subList.push(e);
      }

      // merge sup + subs
      const merged = dedupeEmployeesByChave([...supList, ...subList]);
      return sortByNome(merged);
    },
    [fetchHierarchyForSupervisor, funcionariosByKey, getSupervisorsForBaseGroup]
  );

  const loadRoleIncludes = useCallback(
    async (roles) => {
      const all = await Promise.all((roles || []).map((role) => fetchFuncionariosByFuncao(role)));
      const flat = all.flat();

      const list = [];
      for (const f of flat) {
        const e = toEmployeeFromFuncionario(f);
        if (e) list.push(e);
      }

      return sortByNome(dedupeEmployeesByChave(list));
    },
    [fetchFuncionariosByFuncao]
  );

  const pickGroup = useCallback(
    async (groupName) => {
      if (!groupName) {
        setActiveGroup(null);
        setGroupEmployees(null);
        setGroupError("");
        setGroupLoading(false);
        return;
      }

      setActiveGroup(groupName);

      // ✅ limpa imediatamente
      setGroupEmployees([]);
      setGroupError("");
      setGroupLoading(true);

      const plan = groupPlan?.(groupName) || { baseGroups: [], roleIncludes: [] };
      const baseGroups = Array.isArray(plan.baseGroups) ? plan.baseGroups : [];
      const roleIncludes = Array.isArray(plan.roleIncludes) ? plan.roleIncludes : [];

      try {
        // 1) carrega base groups (supervisores + subordinados)
        const baseLists = await Promise.all(baseGroups.map((bg) => loadBaseGroup(bg)));
        const baseMerged = dedupeEmployeesByChave(baseLists.flat());

        // 2) carrega roles diretas (inclui coordenadores, gerentes, ADM, etc)
        const roleList = await loadRoleIncludes(roleIncludes);

        // 3) merge final
        const finalList = sortByNome(dedupeEmployeesByChave([...baseMerged, ...roleList]));
        setGroupEmployees(finalList);

        // mensagens úteis
        if (!finalList.length) {
          setGroupError(`Grupo ${groupName}: sem resultados (verifique fallbacks/endpoint).`);
        }
      } catch (e) {
        setGroupEmployees([]);
        setGroupError(`Falha ao carregar grupo ${groupName}: ${e?.message ?? String(e)}`);
      } finally {
        setGroupLoading(false);
      }
    },
    [groupPlan, loadBaseGroup, loadRoleIncludes]
  );

  return { activeGroup, groupEmployees, groupLoading, groupError, pickGroup };
}
