import { memo } from "react";

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
  onLoadAgenda,
  onRepor,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="h">Funcionários</div>
        <div className="small">
          Selecionados: <b>{selectedKeys.size}</b>
        </div>
      </div>

      {/* BUSCA */}
      <div className="sidebar-search">
        <label>Buscar (nome / chave / matrícula / função)</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex: JOAO ou 0A1B ou 12345 ou TM AUTOMAÇÃO"
        />
      </div>

      {/* AÇÕES NA LATERAL */}
      <div className="sidebar-actions">
        <button
          className="btn btn-secondary"
          onClick={() => onRefreshEmployees?.()}
        >
          Atualizar funcionários
        </button>

        <button className="btn btn-secondary" onClick={() => onLoadAgenda?.()}>
          Carregar agenda
        </button>

        <button className="btn btn-secondary" onClick={() => onRepor?.()}>
          Repor
        </button>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={selectAll}>
          Selecionar todos
        </button>
        <button className="btn btn-secondary" onClick={clearSelection}>
          Limpar
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
        {funcionarios.map((f) => {
          const k = String(f.Chave ?? "").trim();
          const nome = String(f.Nome ?? "").trim();
          const mat = String(f.Matricula ?? "").trim();
          const func = String(f.Funcao ?? "").trim();
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
                  {nome || "(sem nome)"}{" "}
                  {k ? <span className="func-chip">{k}</span> : null}
                </div>
                <div className="func-sub">
                  {mat ? `Matrícula: ${mat}` : "—"} {func ? `• ${func}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
});
