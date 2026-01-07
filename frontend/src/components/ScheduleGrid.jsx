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

/** ===== LED do Nome (por Função) ===== */
function toneToHex(tone) {
  const t = String(tone || "").trim();
  const map = {
    neutral: "#9ca3af",
    slate: "#0f172a",
    "blue-900": "#1e3a8a",
    "blue-700": "#1d4ed8",
    "blue-200": "#60a5fa",
    "purple-700": "#6d28d9",
    "purple-200": "#a78bfa",
    "green-900": "#065f46",
    "green-700": "#047857",
    "green-200": "#34d399",
    "orange-900": "#9a3412",
    "orange-700": "#c2410c",
    "orange-200": "#fb923c",
    "gray-900": "#111827",
    "gray-700": "#374151",
  };
  return map[t] || "#9ca3af";
}

function roleToTone(roleRaw) {
  const r = String(roleRaw ?? "").trim().toUpperCase();

  // Gerência
  if (r === "GEPLAT" || r === "GEOP" || r === "GERENTES") return "slate";

  // Produção
  if (r === "COPROD") return "green-900";
  if (r === "SUPROD") return "green-700";
  if (r === "TO_P") return "green-200";

  // Manutenção
  if (r === "COMAN") return "blue-900";
  if (r === "SUEIN") return "blue-700";
  if (r === "TMA" || r === "TMI" || r === "TME") return "blue-200";

  // Mecânica
  if (r === "SUMEC") return "purple-700";
  if (r === "TMM") return "purple-200";

  // Embarque
  if (r === "COEMB") return "orange-900";
  if (r === "SUEMB") return "orange-700";
  if (r === "TLT" || r === "TO_E") return "orange-200";

  // Admin / Eng
  if (r === "ADM") return "gray-700";
  if (r === "ENG" || r === "ENGENHARIA") return "gray-900";

  return "neutral";
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
  selectedCount,
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

        const hasMods = e.shiftKey || e.ctrlKey || e.metaKey;
        if (!hasMods && isSelected && Number(selectedCount || 0) === 1) {
          // ✅ “clicar de novo” na mesma célula já selecionada abre edição
          return onCellEditRequest?.(cellKey);
        }

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
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transition,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} data-dragging={isDragging ? "1" : "0"}>
      <td className="sticky-left col-funcao">
        <div className="drag-handle-cell">
          <span
            ref={setActivatorNodeRef}
            className="drag-handle"
            title="Arraste para reordenar"
            {...attributes}
            onPointerDown={(e) => {
              dbg("[HANDLE pointerdown]", { row: id, button: e.button });
              listeners?.onPointerDown?.(e);
            }}
            onKeyDown={(e) => {
              listeners?.onKeyDown?.(e);
            }}
            style={{ cursor: "grab", opacity: 1 }}
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
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveRow?.(id);
            }}
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

  // ✅ edição
  legenda,
  apiPost,
  setAgendaMap,
}) {
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

  function reorderRowOrderByVisible(prevRowOrder, visibleKeys, fromKey, toKey) {
    const from = String(fromKey ?? "");
    const to = String(toKey ?? "");
    if (!from || !to || from === to) return prevRowOrder;

    const vis = (visibleKeys || []).map(String);
    const visSet = new Set(vis);

    const currentVis = prevRowOrder.map(String).filter((k) => visSet.has(k));
    const currentSet = new Set(currentVis);
    for (const k of vis) if (!currentSet.has(k)) currentVis.push(k);

    const fromIdx = currentVis.indexOf(from);
    const toIdx = currentVis.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return prevRowOrder;

    const nextVis = currentVis.slice();
    nextVis.splice(fromIdx, 1);
    nextVis.splice(toIdx, 0, from);

    let i = 0;
    const next = prevRowOrder.map((k) => {
      const kk = String(k);
      if (visSet.has(kk)) return nextVis[i++];
      return k;
    });

    const nextSet = new Set(next.map(String));
    for (const k of nextVis) if (!nextSet.has(k)) next.push(k);

    return next;
  }

  function handleCellClick(cellKey, meta) {
    dbg("[handleCellClick]", { cellKey, meta, anchorCell });

    setSelectedCells((prev) => {
      if (meta?.shift && anchorCell) return selectRangeSameRow(anchorCell, cellKey);

      if (meta?.add) {
        const next = new Set(prev);
        if (next.has(cellKey)) next.delete(cellKey);
        else next.add(cellKey);
        return next;
      }

      return new Set([cellKey]);
    });

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

    await apiPost("/api/agenda/dia", { items });

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEndRow(evt) {
    const { active, over } = evt;
    if (!over) return;
    if (active.id === over.id) return;

    dbg("[DND dragEnd]", { from: active.id, to: over.id });

    setRowOrder((prev) =>
      reorderRowOrderByVisible(prev, visibleKeys, active.id, over.id)
    );
  }

  const renderBody = useMemo(() => {
    const selected = selectedCells || new Set();

    return visibleKeys.map((k) => {
      const f = funcionariosByKey.get(k) || {};
      const funcao = String(f.Funcao ?? "").trim() || "—";
      const mat = String(f.Matricula ?? "").trim() || "—";
      const nomeRaw = String(f.Nome ?? "").trim() || "—";
      const quant = String(f.Quant ?? "").trim() || "—";

      const ledColor = toneToHex(roleToTone(funcao));

      const nomeNode = (
        <div className="name-cell" title={nomeRaw}>
          <span className="name-led" style={{ background: ledColor }} />
          <span className="name-text">{nomeRaw}</span>
        </div>
      );

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
            selectedCount={selected.size}
            title={title}
            onToggleDelete={(ck) => toggleCellDeleted?.(ck)}
            onCellClick={handleCellClick}
            onCellEditRequest={handleCellEditRequest}
          />
        );
      });

      return (
        <SortableRow key={k} id={k} onRemoveRow={onRemoveRow}>
          {funcao}
          {mat}
          {nomeNode}
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
            onDragStart={(evt) => {
              dbg("[DND dragStart]", { id: evt.active?.id });
            }}
            onDragCancel={() => dbg("[DND dragCancel]")}
            onDragEnd={onDragEndRow}
          >
            <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
              <table className="grid">
                <GridHeader headerInfo={headerInfo} sort={sort} onSort={onSort} />
                <tbody>{renderBody}</tbody>
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
