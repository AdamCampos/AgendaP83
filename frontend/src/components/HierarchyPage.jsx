import React, { useEffect, useMemo, useRef, useState } from "react";
import "../HierarchyPage.css";
import { apiGet } from "../lib/api.js";

export default function HierarchyPage({ onEmployeesLoaded, onSelectionChange }) {
  const GROUPS = ["SUEIN", "SUMEC", "SUPROD", "SUEMB"];

  // ✅ Preencha aqui com base na query SQL: WHERE Funcao = '...'
  // (SUEIN você já me mandou)
  const FALLBACK_SUPERVISORS_BY_GROUP = {
    SUEIN: ["FRCF", "NVBN", "RWEU", "WVY4", "YT3I"],
    SUMEC: [],
    SUPROD: [],
    SUEMB: [],
  };

  const [activeGroup, setActiveGroup] = useState("SUEIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());

  // cache opcional (se /api/funcionarios existir no futuro)
  const funcMapRef = useRef(null);

  const selectedCount = useMemo(() => selectedKeys.size, [selectedKeys]);

  function setSelection(next) {
    setSelectedKeys(next);
    onSelectionChange?.(next);
  }

  function toggleKey(k) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      onSelectionChange?.(next);
      return next;
    });
  }

  function selectAll() {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const e of employees) next.add(String(e.Chave));
      onSelectionChange?.(next);
      return next;
    });
  }

  function clearSelection() {
    setSelection(new Set());
  }

  async function ensureFuncionariosMap() {
    if (funcMapRef.current) return funcMapRef.current;

    try {
      // se não existir no backend, cai no catch e segue
      const all = await apiGet("/api/funcionarios?limit=1000");
      const map = new Map();
      for (const f of Array.isArray(all) ? all : []) {
        const k = String(f?.Chave ?? "").trim();
        if (k) map.set(k, f);
      }
      funcMapRef.current = map;
      return map;
    } catch {
      funcMapRef.current = new Map();
      return funcMapRef.current;
    }
  }

  // ✅ Ajuste principal: busca supervisores do grupo
  async function fetchSupervisorsByGroup(grupo) {
    // 1) Tenta o endpoint "ideal" (se existir no backend):
    //    /api/funcionarios?funcao=SUEIN
    try {
      const list = await apiGet(`/api/funcionarios?funcao=${encodeURIComponent(grupo)}&ativo=1&limit=500`);
      const keys = (Array.isArray(list) ? list : [])
        .map((f) => String(f?.Chave ?? "").trim())
        .filter(Boolean);

      if (keys.length) return keys;
    } catch {
      // ignora e cai no fallback
    }

    // 2) Fallback local (funciona agora, mesmo sem /api/funcionarios)
    return (FALLBACK_SUPERVISORS_BY_GROUP[grupo] || [])
      .map((x) => String(x).trim())
      .filter(Boolean);
  }

  async function fetchHierarchyForSupervisor(chave) {
    const k = String(chave || "").trim();
    if (k.length !== 4) return [];

    try {
      const rows = await apiGet(`/api/hierarquia?funcionarioChave=${encodeURIComponent(k)}`);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function dedupeBySubordinadoChave(allRows) {
    const map = new Map();
    for (const r of allRows) {
      const k = String(r?.SubordinadoChave ?? "").trim();
      if (!k) continue;
      if (!map.has(k)) map.set(k, r);
    }
    return Array.from(map.values());
  }

  function toEmployeeListFromHierarchy(rows, funcMap) {
    const out = [];
    for (const r of rows) {
      const chave = String(r?.SubordinadoChave ?? "").trim();
      if (!chave) continue;

      const f = funcMap?.get(chave);
      out.push({
        Chave: chave,
        Nome: f?.Nome ?? r?.NomeSubordinado ?? "(sem nome)",
        Matricula: f?.Matricula ?? "",
        Funcao: f?.Funcao ?? "",
        _NomeSuperior: r?.NomeSuperior ?? "",
        _FuncaoSuperior: r?.FuncaoSuperior ?? "",
        _Nivel: r?.Nivel ?? null,
      });
    }

    out.sort((a, b) => String(a.Nome).localeCompare(String(b.Nome), "pt-BR"));
    return out;
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setError("");
      setLoading(true);

      try {
        const funcMap = await ensureFuncionariosMap();

        // ✅ agora sempre vai vir algo para SUEIN (via fallback)
        const supervisors = await fetchSupervisorsByGroup(activeGroup);

        if (!supervisors.length) {
          setEmployees([]);
          setSelection(new Set());
          onEmployeesLoaded?.([]);
          setError(
            `Nenhum supervisor configurado/encontrado para ${activeGroup}. ` +
              `Preencha FALLBACK_SUPERVISORS_BY_GROUP para este grupo.`
          );
          return;
        }

        // busca hierarquia de TODOS os supervisores do grupo
        const allRows = [];
        for (const sup of supervisors) {
          const rows = await fetchHierarchyForSupervisor(sup);
          for (const r of rows) allRows.push(r);
        }

        const unique = dedupeBySubordinadoChave(allRows);
        const list = toEmployeeListFromHierarchy(unique, funcMap);

        if (cancelled) return;

        setEmployees(list);
        onEmployeesLoaded?.(list);

        // limpa seleção ao trocar grupo
        setSelection(new Set());

        if (!list.length) {
          setError(
            `Supervisores encontrados (${supervisors.length}), mas a hierarquia retornou 0 subordinados. ` +
              `Verifique se /api/hierarquia está retornando dados para essas chaves: ${supervisors.join(", ")}`
          );
        }
      } catch (e) {
        if (cancelled) return;
        setError(`Erro ao carregar grupo ${activeGroup}: ${e?.message ?? String(e)}`);
        setEmployees([]);
        setSelection(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // ✅ IMPORTANTÍSSIMO: não coloque callbacks aqui, senão reexecuta por referência
  }, [activeGroup]);

  return (
    <div className="hierarchy-container">
      <h1>Hierarquia / Seleção por Grupo</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActiveGroup(g)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              cursor: "pointer",
              fontWeight: g === activeGroup ? "700" : "500",
            }}
          >
            {g}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div><b>Grupo:</b> {activeGroup}</div>
        <div>
          <b>Carregados:</b> {employees.length} &nbsp;|&nbsp; <b>Selecionados:</b> {selectedCount}
        </div>
        {loading && <div>Carregando…</div>}
        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={selectAll} disabled={!employees.length}>
          Selecionar todos
        </button>
        <button type="button" onClick={clearSelection} disabled={!selectedCount}>
          Limpar seleção
        </button>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
        {!employees.length && !loading ? (
          <div>Nenhum empregado para exibir.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {employees.map((e) => {
              const chave = String(e.Chave);
              const checked = selectedKeys.has(chave);
              return (
                <li key={chave} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleKey(chave)} />
                    <span style={{ minWidth: 56, fontFamily: "monospace" }}>{chave}</span>
                    <span style={{ fontWeight: 600 }}>{e.Nome}</span>
                    {e.Funcao ? <span style={{ opacity: 0.75 }}>({e.Funcao})</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
