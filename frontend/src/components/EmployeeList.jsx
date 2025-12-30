import { memo } from "react";

export default memo(function EmployeeList({
  funcionarios,
  selectedKeys,
  toggleSelectKey,
  somenteSelecionados,
  setSomenteSelecionados,
  ativos,
  setAtivos,
  selectAll,
  clearSelection,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="h">Funcionários</div>
        <div className="small">
          Selecionados: <b>{selectedKeys.size}</b>
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={() => setAtivos((v) => !v)}>
          {ativos ? "Somente ativos ✅" : "Incluindo inativos"}
        </button>
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
          const checked = selectedKeys.has(k);

          return (
            <div className="func-item" key={k}>
              <input type="checkbox" checked={checked} onChange={() => toggleSelectKey(k)} />
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
      </div>
    </aside>
  );
});
