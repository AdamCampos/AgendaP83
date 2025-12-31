import { memo, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ===== Defaults (sigla -> significado) =====
// Se preferir, você pode remover daqui e passar do App via props.
const DEFAULT_CODE_LABELS = {
  EM: "EMBARCADO",
  L: "LICENÇA",
  TR: "TREINAMENTO",
  EVT: "EVENTO/MISSÃO",
  B: "BASE",
  HO: "HOME OFFICE",
  NB: "NÃO MOBILIZADO",
  PT: "EM TRANSFERÊNCIA",
  IN: "INTERINO",

  O: "FOLGA",
  A: "AFASTADO",
  F: "FÉRIAS",
  FS: "FINAL DE SEMANA/FERIADO",

  HZH1: "HAZOP Vendor Hull 1",
  DR3T: "DR30 TS",
  HZPR: "HAZOP Process",
  HZH2: "HAZOP Vendor Hull 2",
  HZH3: "HAZOP Vendor Hull 3",
  HZUT: "HAZOP Utilities",
  DR6T: "DR60 TOPSIDE",
  ANG: "ANGRA",
  HAY: "HAYANG",

  PUN: "PUNE",
  NTG: "NANTONG",
  SGP: "SINGAPURA",

  YNT: "YANTAI",
  BT: "BATAM",
  HOE: "HOME OFFICE EXTRA",
};

function normalizeCode(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s ? s : "";
}

function getMeaning(code, codeStyles) {
  const c = normalizeCode(code);
  if (!c) return "";
  return codeStyles?.[c]?.label || DEFAULT_CODE_LABELS[c] || "";
}

function buildCellTooltip({ rowKey, dateStr, code, obs }, codeStyles) {
  const c = normalizeCode(code) || "";
  const meaning = getMeaning(c, codeStyles);

  const line1 = `${rowKey} • ${dateStr}`;
  const line2 = c ? (meaning ? `${c} — ${meaning}` : `${c}`) : "";
  const line3 = obs ? `Obs: ${obs}` : "";

  return [line1, line2, line3].filter(Boolean).join("\n");
}

const GridHeader = memo(function GridHeader({ headerInfo, sort, onSort }) {
  const sortMark = (col) => {
    if (sort?.col !== col || !sort?.dir) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  };

  return (
    <thead>
      <tr>
        <th
          className="sticky-left col-funcao th-sort"
          rowSpan={2}
          onClick={() => onSort?.("Funcao")}
          title="Ordenar por Função"
        >
          Função{sortMark("Funcao")}
        </th>
        <th
          className="sticky-left2 col-matricula th-sort"
          rowSpan={2}
          onClick={() => onSort?.("Matricula")}
          title="Ordenar por Matrícula"
        >
          Matrícula{sortMark("Matricula")}
        </th>
        <th
          className="sticky-left3 col-nome th-sort"
          rowSpan={2}
          onClick={() => onSort?.("Nome")}
          title="Ordenar por Nome"
        >
          Nome{sortMark("Nome")}
        </th>
        <th
          className="sticky-left4 col-chave th-sort"
          rowSpan={2}
          onClick={() => onSort?.("Chave")}
          title="Ordenar por Chave"
        >
          Chave{sortMark("Chave")}
        </th>
        <th
          className="sticky-left5 col-quant th-sort"
          rowSpan={2}
          onClick={() => onSort?.("Quant")}
          title="Ordenar por Quant."
        >
          Quant.{sortMark("Quant")}
        </th>

        {headerInfo.groups.map((g) => (
          <th key={g.monthKey} className="month-band" colSpan={g.count}>
            {g.monthLabel}
          </th>
        ))}
      </tr>

      <tr>
        {headerInfo.days.map((d) => (
          <th
            key={d.iso}
            className={`day-header ${d.isWeekend ? "weekend" : ""} ${
              d.isMonthStart ? "month-start" : ""
            }`}
            title={d.iso}
          >
            {d.day}
          </th>
        ))}
      </tr>
    </thead>
  );
});

const DayCell = memo(function DayCell({
  cellKey,
  iso,
  isWeekend,
  isMonthStart,
  codigo,
  isDeleted,
  title,
  onToggleDelete,
}) {
  const cls = [
    "day",
    isWeekend ? "weekend" : "",
    isMonthStart ? "month-start" : "",
    !codigo ? "empty" : `code code-${codigo}`,
    isDeleted ? "deleted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <td
      className={cls}
      title={title}
      onClick={(e) => {
        if (e.altKey) onToggleDelete(cellKey);
      }}
      data-iso={iso}
    >
      {codigo ? codigo : "·"}
    </td>
  );
});

function SortableRow({ id, children, onRemoveRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // ✅ sticky em tabela costuma quebrar quando o <tr> tem transform sempre.
  // então: só aplica transform quando estiver arrastando de fato.
  const style = {
    transition,
    ...(isDragging && transform
      ? { transform: CSS.Transform.toString(transform) }
      : {}),
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} data-dragging={isDragging ? "1" : "0"}>
      <td className="sticky-left col-funcao">
        <div className="drag-handle-cell">
          <span
            className="drag-handle"
            title="Arraste para reordenar"
            {...attributes}
            {...listeners}
          >
            ⠿
          </span>
          <span className="row-main">{children[0]}</span>
        </div>
      </td>

      <td className="sticky-left2 col-matricula">{children[1]}</td>
      <td className="sticky-left3 col-nome">{children[2]}</td>

      <td className="sticky-left4 col-chave">
        <div className="row-key">
          <b>{children[3]}</b>
          <button
            className="row-remove"
            title="Remover da grid"
            onClick={() => onRemoveRow?.(id)}
            type="button"
          >
            ×
          </button>
        </div>
      </td>

      <td className="sticky-left5 col-quant">{children[4]}</td>
      {children.slice(5)}
    </tr>
  );
}

export default function ScheduleGrid({
  visibleKeys,
  funcionariosByKey,
  headerInfo,
  agendaMap,
  deletedCells,
  toggleCellDeleted,
  rowOrder,
  setRowOrder,
  onRemoveRow,
  sort,
  onSort,
  onExitSort, // ✅ quando arrastar, sai do modo "sort"

  // ✅ novo: estilos (para pegar label/significado)
  codeStyles,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEndRow(evt) {
    const { active, over } = evt;
    if (!over) return;
    if (active.id === over.id) return;

    // ✅ se estava ordenado, ao reordenar manualmente vira "ordem manual"
    if (sort?.col && sort?.dir) onExitSort?.();

    setRowOrder((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  const renderBody = useMemo(() => {
    return visibleKeys.map((k) => {
      const f = funcionariosByKey.get(k) || {};
      const funcao = String(f.Funcao ?? "").trim() || "—";
      const mat = String(f.Matricula ?? "").trim() || "—";
      const nome = String(f.Nome ?? "").trim() || "—";
      const quant = String(f.Quant ?? "").trim() || "—";

      const cells = headerInfo.days.map((d) => {
        const cellKey = `${k}|${d.iso}`;
        const row = agendaMap.get(cellKey);

        const codigoRaw = String(row?.Codigo ?? "").trim();
        const codigo = normalizeCode(codigoRaw);
        const isDeleted = deletedCells.has(cellKey);

        // ✅ tooltip novo: sem "Fonte: ESCALA"
        const title = buildCellTooltip(
          {
            rowKey: k,
            dateStr: d.iso,
            code: codigo,
            obs: String(row?.Observacao ?? "").trim(),
          },
          codeStyles
        );

        return (
          <DayCell
            key={cellKey}
            cellKey={cellKey}
            iso={d.iso}
            isWeekend={d.isWeekend}
            isMonthStart={d.isMonthStart}
            codigo={codigo}
            isDeleted={isDeleted}
            title={title}
            onToggleDelete={toggleCellDeleted}
          />
        );
      });

      return (
        <SortableRow key={k} id={k} onRemoveRow={onRemoveRow}>
          {funcao}
          {mat}
          {nome}
          {k}
          {quant}
          {cells}
        </SortableRow>
      );
    });
  }, [
    visibleKeys,
    funcionariosByKey,
    headerInfo.days,
    agendaMap,
    deletedCells,
    toggleCellDeleted,
    onRemoveRow,
    codeStyles, // ✅ importante
  ]);

  return (
    <div className="grid-wrap">
      <div className="grid-inner">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEndRow}
        >
          <SortableContext
            items={visibleKeys}
            strategy={verticalListSortingStrategy}
          >
            <table className="grid">
              <GridHeader headerInfo={headerInfo} sort={sort} onSort={onSort} />
              <tbody>{renderBody}</tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
