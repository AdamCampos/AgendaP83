const { createElement, useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;
const h = createElement;

let root = null;

let funcionarios = [];
let selecionados = new Set();

function renderLista() {
  const box = document.getElementById("funcList");
  box.innerHTML = "";

  funcionarios.forEach(f => {
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = selecionados.has(f.Chave);
    chk.onchange = () => {
      chk.checked ? selecionados.add(f.Chave) : selecionados.delete(f.Chave);
      renderGrid();
    };

    const div = document.createElement("div");
    div.appendChild(chk);
    div.append(" " + f.Nome);

    box.appendChild(div);
  });
}

function renderGrid() {
  if (!root) {
    root = createRoot(document.getElementById("grid"));
  }

  const rows = funcionarios.filter(f => selecionados.has(f.Chave));

  root.render(
    h(GridTable, {
      rows,
      onRemove: chave => {
        selecionados.delete(chave);
        renderLista();
        renderGrid();
      }
    })
  );
}

function GridTable({ rows, onRemove }) {
  const [data, setData] = useState(rows);
  const dragRef = useRef(null);

  useEffect(() => setData(rows), [rows]);

  function move(to) {
    const from = dragRef.current;
    if (!from || from === to) return;

    const copy = [...data];
    const a = copy.findIndex(x => x.Chave === from);
    const b = copy.findIndex(x => x.Chave === to);
    const [m] = copy.splice(a, 1);
    copy.splice(b, 0, m);
    setData(copy);
  }

  return h(
    "tbody",
    null,
    data.map(f =>
      h(
        "tr",
        {
          key: f.Chave,
          draggable: true,
          onDragStart: () => dragRef.current = f.Chave,
          onDragOver: e => e.preventDefault(),
          onDrop: () => move(f.Chave)
        },
        h("td", { className: "sticky col-mat" }, f.Matricula),
        h("td", { className: "sticky col-nome" }, f.Nome),
        h("td", { className: "sticky col-chave" }, f.Chave),
        h(
          "td",
          null,
          h("button", { onClick: () => onRemove(f.Chave) }, "×")
        )
      )
    )
  );
}

async function init() {
  funcionarios = await fetch("/api/funcionarios").then(r => r.json());
  renderLista();
}

init();
