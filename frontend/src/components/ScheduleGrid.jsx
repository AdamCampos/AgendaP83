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

const GridHeader = memo(function GridHeader({ headerInfo }) {
  return (
    <thead>
      <tr>
        <th className="sticky-left col-funcao" rowSpan={2}>Função</th>
        <th className="sticky-left2 col-matricula" rowSpan={2}>Matrícula</th>
        <th className="sticky-left3 col-nome" rowSpan={2}>Nome</th>
        <th className="sticky-left4 col-chave" rowSpan={2}>Chave</th>
        <th className="sticky-left5 col-quant" rowSpan={2}>Quant.</th>

        {headerInfo.groups.map((g) => (
          <th key={g.monthKey} className="month-band" colSpan={g.count}>
            {g.monthLabel}
          </th>
        ))}
      </tr>

      <tr>
        {headerInfo.days.map((d) => (
          <th key={d.iso} className={`day-header ${d.isWeekend ? "weekend" : ""}`} title={d.iso}>
            {d.day}
          </th>
        ))}
      </tr>
    </thead>
  );
});

const DayCell = memo(function DayCell({ cellKey, iso, isWeekend, codigo, isDeleted, title, onToggleDelete }) {
  const cls = [
    "day",
    isWeekend ? "weekend" : "",
    !codigo ? "empty" : `code code-${codigo}`,
    isDeleted ? "deleted" : "",
  ].filter(Boolean).join(" ");

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

function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} data-dragging={isDragging ? "1" : "0"}>
      <td className="sticky-left col-funcao drag-handle-cell">
        <span className="drag-handle" title="Arraste para reordenar" {...attributes} {...listeners}>
          ⠿
        </span>
        <span>{children[0]}</span>
      </td>
      <td className="sticky-left2 col-matricula">{children[1]}</td>
      <td className="sticky-left3 col-nome">{children[2]}</td>
      <td className="sticky-left4 col-chave">{children[3]}</td>
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
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEndRow(evt) {
    const { active, over } = evt;
    if (!over) return;
    if (active.id === over.id) return;

    setRowOrder((prev) => {
      const oldIndex = prev.indexOf(active.id);
      const newIndex = prev.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return (
    <div className="grid-wrap">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndRow}>
        <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
          <table className="grid">
            <GridHeader headerInfo={headerInfo} />

            <tbody>
              {visibleKeys.map((k) => {
                const f = funcionariosByKey.get(k) || {};
                const funcao = String(f.Funcao ?? "").trim() || "—";
                const mat = String(f.Matricula ?? "").trim() || "—";
                const nome = String(f.Nome ?? "").trim() || "—";
                const quant = String(f.Quant ?? "").trim() || "—";

                return (
                  <SortableRow key={k} id={k}>
                    {funcao}
                    {mat}
                    {nome}
                    {k}
                    {quant}

                    {headerInfo.days.map((d) => {
                      const cellKey = `${k}|${d.iso}`;
                      const row = agendaMap.get(cellKey);
                      const codigo = String(row?.Codigo ?? "").trim();
                      const isDeleted = deletedCells.has(cellKey);

                      const title = row
                        ? `${k} • ${d.iso}\n${codigo}\nFonte: ${row.Fonte ?? ""}\nObs: ${row.Observacao ?? ""}`
                        : `${k} • ${d.iso}`;

                      return (
                        <DayCell
                          key={cellKey}
                          cellKey={cellKey}
                          iso={d.iso}
                          isWeekend={d.isWeekend}
                          codigo={codigo}
                          isDeleted={isDeleted}
                          title={title}
                          onToggleDelete={toggleCellDeleted}
                        />
                      );
                    })}
                  </SortableRow>
                );
              })}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </div>
  );
}
