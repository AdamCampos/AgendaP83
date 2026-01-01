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
  onRepor,
}) {
  // Função para filtrar os funcionários por chave, nome, matrícula, função e grupo
  const filterByGroup = (searchTerm) => {
    return funcionarios.filter(f => {
      // Convertendo para minúsculas para permitir pesquisa sem diferenciar maiúsculas/minúsculas
      const lowerSearchTerm = searchTerm.toLowerCase();
      const nomeMatch = f.Nome.toLowerCase().includes(lowerSearchTerm);
      const chaveMatch = f.Chave.toLowerCase().includes(lowerSearchTerm);
      const matriculaMatch = f.Matricula.toLowerCase().includes(lowerSearchTerm);
      const funcaoMatch = f.Funcao.toLowerCase().includes(lowerSearchTerm);

      // Filtragem por grupo
      const grupoMatch = 
        (searchTerm === "SUEIN" && ['TMA', 'TMI', 'TME'].includes(f.Funcao)) ||
        (searchTerm === "TMM" && f.Funcao === 'TMM') ||
        (searchTerm === "SUPROD" && ['TMI', 'TME', 'TMA'].includes(f.Funcao)) ||
        (searchTerm === "SUEMB" && ['TLT', 'TES'].includes(f.Funcao)) ||
        (searchTerm === "COMAN" && ['SUEIN', 'SUMEC'].includes(f.Funcao)) ||
        (searchTerm === "COEMB" && f.Funcao === "SUEMB") ||
        (searchTerm === "COPROD" && f.Funcao === "SUPROD") ||
        (searchTerm === "GEOP" && f.Funcao === "GEOP") ||
        (searchTerm === "GEPLAT" && f.Funcao === "GEPLAT");

      // Retorna verdadeiro se qualquer parte corresponder ao termo de pesquisa
      return nomeMatch || chaveMatch || matriculaMatch || funcaoMatch || grupoMatch;
    });
  };

  // Filtra os funcionários com base no termo de busca
  const filteredFuncionarios = filterByGroup(q);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="h">Funcionários</div>
        <div className="small">
          Selecionados: <b>{selectedKeys.size}</b>
        </div>
      </div>

      <div className="sidebar-search">
        <label>Buscar (nome / chave / matrícula / função)</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex: JOÃO, 0A1B, 12345, TMA"
        />
      </div>

      <div className="sidebar-actions">
        <button
          className="btn btn-secondary"
          onClick={() => onRefreshEmployees?.()}
          type="button"
        >
          Atualizar funcionários
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => onRepor?.()}
          type="button"
        >
          Repor (limpa grid)
        </button>
      </div>

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={selectAll} type="button">
          Selecionar todos
        </button>
        <button
          className="btn btn-secondary"
          onClick={clearSelection}
          type="button"
        >
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
        {filteredFuncionarios.map((f) => {
          const k = String(f.Chave ?? "").trim();
          const nome = String(f.Nome ?? "").trim();
          const mat = String(f.Matricula ?? "").trim();
          const func = String(f.Funcao ?? "").trim();
          const checked = k ? selectedKeys.has(k) : false;

          // Aplica classes para identificar visualmente grupos
          let rowClass = "";
          if (['TMA', 'TMI', 'TME'].includes(func)) {
            rowClass = 'suein'; // SUEIN
          } else if (func === "TMM") {
            rowClass = 'sumec'; // SUMEC
          } else if (['TLT', 'TES'].includes(func)) {
            rowClass = 'suemb'; // SUEMB
          } else if (['TMI', 'TME', 'TMA'].includes(func)) {
            rowClass = 'suem'; // Técnicos de operação (subordinados a SUPROD)
          }

          return (
            <div className={`func-item ${rowClass}`} key={k || `${nome}-${mat}-${func}`}>
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
