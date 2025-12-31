import { memo, useMemo, useState } from "react";
import CellEditorModal from "./CellEditorModal.jsx";
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

/** 🔎 Liga/desliga debug */
const DEBUG_CELLS = true;
const dbg = (...args) => DEBUG_CELLS && console.debug(...args);

// ===== Defaults (sigla -> significado) =====
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
  const c = normalizeCode(code);
  const meaning = c ? getMeaning(c, codeStyles) : "";

  const obsTxt = String(obs ?? "").trim();

  const line1 = `${rowKey} • ${dateStr}`;
  const line2 = c ? (meaning ? `${c} — ${meaning}` : `${c}`) : "—";
  const line3 = obsTxt ? `Obs: ${obsTxt}` : "";

  return [line1, line2, line3].filter(Boolean).join("\n");
}


function parseCellKey(cellKey) {
  const [fk, iso] = String(cellKey || "").split("|");
  return { fk, iso };
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
  isSelected,
  title,
  onToggleDelete,
  onCellClick,
  onCellEditRequest,
}) {
  const cls = [
    "day",
    isWeekend ? "weekend" : "",
    isMonthStart ? "month-start" : "",
    !codigo ? "empty" : `code code-${codigo}`,
    isDeleted ? "deleted" : "",
    isSelected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <td
      className={cls}
      title={title}
      data-iso={iso}
      onPointerDown={(e) => {
        dbg("[TD pointerdown]", {
          cellKey,
          iso,
          codigo,
          button: e.button,
          alt: e.altKey,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
        });
      }}
      onPointerUp={(e) => {
        dbg("[TD pointerup]", {
          cellKey,
          iso,
          codigo,
          alt: e.altKey,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
        });
      }}
      onClick={(e) => {
        dbg("[TD click]", {
          cellKey,
          iso,
          codigo,
          alt: e.altKey,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
        });

        if (e.altKey) return onToggleDelete?.(cellKey);

        onCellClick?.(cellKey, {
          shift: e.shiftKey,
          add: e.ctrlKey || e.metaKey,
        });
      }}
      onDoubleClick={() => {
        dbg("[TD dblclick]", { cellKey, iso, codigo });
        onCellEditRequest?.(cellKey);
      }}
    >
      {codigo ? codigo : "·"}
    </td>
  );
});

function SortableRow({ id, children, onRemoveRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // ✅ sticky + transform em <tr> quebra. Só aplica transform quando estiver arrastando.
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
            onPointerDown={(e) => {
              // importantíssimo: não deixa pointerdown do handle interferir no clique da célula
              e.stopPropagation();
              dbg("[HANDLE pointerdown]", { row: id });
            }}
            onClick={(e) => {
              e.stopPropagation();
              dbg("[HANDLE click]", { row: id });
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              dbg("[ROW remove]", { row: id });
              onRemoveRow?.(id);
            }}
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
  onExitSort,
  codeStyles,

  // ✅ novo: edição
  legenda,
  apiPost,
  setAgendaMap,
}) {
  // ===== seleção/edição (fica no Grid) =====
  const [selectedCells, setSelectedCells] = useState(() => new Set());
  const [anchorCell, setAnchorCell] = useState(null);
  const [cellEditorOpen, setCellEditorOpen] = useState(false);

  const isoList = useMemo(() => headerInfo.days.map((d) => d.iso), [headerInfo]);
  const isoIndex = useMemo(() => {
    const m = new Map();
    isoList.forEach((iso, idx) => m.set(iso, idx));
    return m;
  }, [isoList]);

  function selectRangeSameRow(fromKey, toKey) {
    const a = parseCellKey(fromKey);
    const b = parseCellKey(toKey);

    if (!a.fk || !a.iso || !b.fk || !b.iso) return new Set([toKey]);
    if (a.fk !== b.fk) return new Set([toKey]);

    const ia = isoIndex.get(a.iso);
    const ib = isoIndex.get(b.iso);
    if (ia == null || ib == null) return new Set([toKey]);

    const start = Math.min(ia, ib);
    const end = Math.max(ia, ib);

    const s = new Set();
    for (let i = start; i <= end; i++) s.add(`${a.fk}|${isoList[i]}`);
    return s;
  }

  function handleCellClick(cellKey, meta) {
    dbg("[handleCellClick]", { cellKey, meta, anchorCell });

    setSelectedCells((prev) => {
      // SHIFT -> range substitui seleção
      if (meta?.shift && anchorCell) {
        const range = selectRangeSameRow(anchorCell, cellKey);
        dbg("[range]", {
          anchor: anchorCell,
          to: cellKey,
          count: range.size,
        });
        return range;
      }

      // CTRL/CMD -> toggle
      if (meta?.add) {
        const next = new Set(prev);
        if (next.has(cellKey)) next.delete(cellKey);
        else next.add(cellKey);
        return next;
      }

      // clique simples -> só 1
      return new Set([cellKey]);
    });

    // anchor atualiza depois do cálculo acima (para SHIFT funcionar bem)
    setAnchorCell(cellKey);
  }

  function handleCellEditRequest(cellKey) {
    dbg("[handleCellEditRequest]", { cellKey });

    setSelectedCells((prev) => (prev.has(cellKey) ? prev : new Set([cellKey])));
    setAnchorCell(cellKey);
    setCellEditorOpen(true);
  }

  async function applyCells({ codigo, observacao }) {
    const keys = Array.from(selectedCells);
    dbg("[applyCells] start", { count: keys.length, codigo, observacao });

    if (!keys.length) return;

    const items = keys.map((ck) => {
      const { fk, iso } = parseCellKey(ck);
      return {
        FuncionarioChave: fk,
        Data: iso,
        Codigo: codigo,
        Fonte: "USUARIO",
        Observacao: observacao ?? "",
      };
    });

    dbg("[applyCells] payload", items.slice(0, 5), `... total=${items.length}`);

    await apiPost("/api/agenda/dia", { items });

    // Atualiza local sem reload
    setAgendaMap((prev) => {
      const next = new Map(prev);
      for (const it of items) {
        const k = `${it.FuncionarioChave}|${it.Data}`;
        next.set(k, {
          FuncionarioChave: it.FuncionarioChave,
          Data: it.Data,
          Codigo: it.Codigo,
          Fonte: it.Fonte,
          Observacao: it.Observacao || null,
        });
      }
      return next;
    });

    setSelectedCells(new Set());
    setCellEditorOpen(false);

    dbg("[applyCells] done");
  }

  // ===== DND =====
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEndRow(evt) {
    const { active, over } = evt;
    if (!over) return;
    if (active.id === over.id) return;

    dbg("[DND dragEnd]", { from: active.id, to: over.id });

    if (sort?.col && sort?.dir) onExitSort?.();

    setRowOrder((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  const renderBody = useMemo(() => {
    const selected = selectedCells || new Set();

    return visibleKeys.map((k) => {
      const f = funcionariosByKey.get(k) || {};
      const funcao = String(f.Funcao ?? "").trim() || "—";
      const mat = String(f.Matricula ?? "").trim() || "—";
      const nome = String(f.Nome ?? "").trim() || "—";
      const quant = String(f.Quant ?? "").trim() || "—";

      const cells = headerInfo.days.map((d) => {
        const cellKey = `${k}|${d.iso}`;
        const row = agendaMap.get(cellKey);

        const codigo = normalizeCode(String(row?.Codigo ?? "").trim());
        const isDeleted = deletedCells.has(cellKey);
        const isSelected = selected.has(cellKey);

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
            isSelected={isSelected}
            title={title}
            onToggleDelete={(ck) => {
              dbg("[toggleCellDeleted]", ck);
              toggleCellDeleted?.(ck);
            }}
            onCellClick={handleCellClick}
            onCellEditRequest={handleCellEditRequest}
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
    codeStyles,
    selectedCells,
    anchorCell,
    isoIndex,
    isoList,
  ]);

  return (
    <>
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
              <table
                className="grid"
                onPointerDown={(e) => dbg("[TABLE pointerdown]", e.target?.tagName)}
                onClick={(e) => dbg("[TABLE click]", e.target?.tagName)}
              >
                <GridHeader
                  headerInfo={headerInfo}
                  sort={sort}
                  onSort={onSort}
                />
                <tbody
                  onPointerDown={(e) => dbg("[TBODY pointerdown]", e.target?.tagName)}
                  onClick={(e) => dbg("[TBODY click]", e.target?.tagName)}
                >
                  {renderBody}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <CellEditorModal
        open={cellEditorOpen}
        selectedCount={selectedCells.size}
        legenda={legenda}
        onClose={() => setCellEditorOpen(false)}
        onApply={applyCells}
      />
    </>
  );
}
