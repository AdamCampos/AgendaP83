import { memo, useMemo } from "react";

function normalizeText(v) {
  return String(v ?? "").toLowerCase();
}

function matchesQuery(f, q) {
  if (!q) return true;
  const term = normalizeText(q.trim());
  if (!term) return true;

  return (
    normalizeText(f?.Nome).includes(term) ||
    normalizeText(f?.Chave).includes(term) ||
    normalizeText(f?.Matricula).includes(term) ||
    normalizeText(f?.Funcao).includes(term)
  );
}

export default memo(function EmployeeList({
  q,
  setQ,
  funcionarios,
  selectedKeys,
  toggleSelectKey,
  somenteSelecionados,
  setSomenteSelecionados,
  selectAll,
  clearSelection,
  onRefreshEmployees,
  onRepor,

  // grupos
  groups = [],
  activeGroup = null,
  onPickGroup,
  groupLoading = false,
  groupError = "",
}) {
  const list = Array.isArray(funcionarios) ? funcionarios : [];

  const filtered = useMemo(() => {
    const qTrim = String(q ?? "").trim();
  
    // 1) começa com a lista inteira
    let base = list;
  
    // 2) aplica busca primeiro
    if (qTrim) base = base.filter((f) => matchesQuery(f, qTrim));
  
    // 3) só aplica "somente selecionados" no modo normal (activeGroup === null)
    if (somenteSelecionados && activeGroup === null) {
      base = base.filter((f) => {
        const k = String(f?.Chave ?? "").trim();
        return k && selectedKeys.has(k);
      });
    }
  
    return base;
  }, [list, q, somenteSelecionados, selectedKeys, activeGroup]);
  

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="h">Funcionários</div>
        <div className="small">
          Selecionados: <b>{selectedKeys.size}</b>
        </div>
      </div>

      {/* Grupos (modo hierarquia) */}
      <div className="sidebar-actions" style={{ gap: 6, flexWrap: "wrap" }}>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => onPickGroup?.(null)}
          title="Voltar ao modo normal"
          style={{ fontWeight: activeGroup === null ? 800 : 600 }}
          disabled={groupLoading}
        >
          TODOS
        </button>

        {groups.map((g) => (
          <button
            key={g}
            className="btn btn-secondary"
            type="button"
            onClick={() => onPickGroup?.(g)}
            style={{ fontWeight: activeGroup === g ? 800 : 600 }}
            disabled={groupLoading}
          >
            {g}
          </button>
        ))}
      </div>

      {groupLoading ? <div className="small">Carregando grupo…</div> : null}
      {groupError ? (
        <div className="small" style={{ color: "crimson" }}>
          {groupError}
        </div>
      ) : null}

      <div className="sidebar-search">
        <label>Buscar (nome / chave / matrícula / função)</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex: JOÃO, 0A1B, 12345, TMA"
        />
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={onRefreshEmployees} type="button">
          Atualizar funcionários
        </button>
        <button className="btn btn-secondary" onClick={onRepor} type="button">
          Repor (limpa grid)
        </button>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={selectAll} type="button" disabled={!list.length}>
          Selecionar todos
        </button>
        <button className="btn btn-secondary" onClick={clearSelection} type="button" disabled={selectedKeys.size === 0}>
          Limpar seleção
        </button>
      </div>

      <div className="sidebar-actions">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={somenteSelecionados}
            onChange={(e) => setSomenteSelecionados(e.target.checked)}
          />
          Mostrar apenas selecionados
        </label>
      </div>

      <div className="func-list">
        {filtered.map((f) => {
          const k = String(f?.Chave ?? "").trim();
          const nome = String(f?.Nome ?? "").trim();
          const mat = String(f?.Matricula ?? "").trim();
          const func = String(f?.Funcao ?? "").trim();
          const checked = k ? selectedKeys.has(k) : false;

          return (
            <div className="func-item" key={k || `${nome}-${mat}-${func}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!k}
                onChange={() => k && toggleSelectKey(k)}
              />

              <div className="func-meta">
                <div className="func-name">
                  {nome || "(sem nome)"} {k ? <span className="func-chip">{k}</span> : null}
                </div>
                <div className="func-sub">
                  {mat ? `Matrícula: ${mat}` : "—"} {func ? `• ${func}` : ""}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div className="small" style={{ padding: 8, opacity: 0.75 }}>
            Nenhum funcionário para exibir.
          </div>
        ) : null}
      </div>
    </aside>
  );
});
