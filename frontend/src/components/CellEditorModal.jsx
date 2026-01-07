import { useEffect, useMemo, useRef, useState } from "react";

function normalizeCode(v) {
  return String(v ?? "").trim().toUpperCase();
}
function normISO(v) {
  return String(v ?? "").trim();
}
function swapIfNeeded(a, b) {
  if (a && b && a > b) return [b, a];
  return [a, b];
}

export default function CellEditorModal({
  open,
  selectedCount,
  selectedEmployeesCount = 0,
  periodDefaultInicio = "",
  periodDefaultFim = "",
  legenda,
  defaultCodigo,
  defaultObs,
  onClose,
  onApply, // ({ codigo, observacao, period }) => Promise<void>
}) {
  const options = useMemo(() => {
    const list = Array.isArray(legenda) ? legenda : [];

    return list
      .map((x) => {
        const codigo = normalizeCode(x?.Codigo);
        const desc = String(x?.Descricao ?? x?.Nome ?? "").trim();
        const ativo = x?.Ativo == null ? true : !!x?.Ativo;
        return { codigo, desc, tipo: String(x?.Tipo ?? "").trim(), ativo };
      })
      .filter((x) => x.codigo && x.ativo)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
  }, [legenda]);

  const [codigo, setCodigo] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  // período
  const [usePeriod, setUsePeriod] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [somenteUteis, setSomenteUteis] = useState(false);

  // refs p/ “modal real”
  const modalRef = useRef(null);
  const lastActiveRef = useRef(null);

  // drag state
  const [pos, setPos] = useState(null); // {left, top} | null (null = centralizado)
  const dragRef = useRef({
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  useEffect(() => {
    if (!open) return;

    setCodigo(defaultCodigo ? normalizeCode(defaultCodigo) : "");
    setObs(String(defaultObs ?? ""));
    setSaving(false);

    setUsePeriod(false);
    setInicio(normISO(periodDefaultInicio));
    setFim(normISO(periodDefaultFim));
    setSomenteUteis(false);

    // ao abrir, volta pro centro (opcional — se quiser manter posição, remova)
    setPos(null);
  }, [open, defaultCodigo, defaultObs, periodDefaultInicio, periodDefaultFim]);

  // ✅ Scroll lock + guardar/restaurar foco
  useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // foca no primeiro elemento focável dentro do modal
    queueMicrotask(() => {
      const root = modalRef.current;
      if (!root) return;
      const focusable = root.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus?.();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      lastActiveRef.current?.focus?.();
    };
  }, [open]);

  // ✅ ESC fecha + Focus trap (Tab)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!saving) onClose?.();
        return;
      }

      if (e.key === "Tab") {
        const root = modalRef.current;
        if (!root) return;

        const nodes = Array.from(
          root.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");

        if (!nodes.length) return;

        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, saving, onClose]);

  if (!open) return null;

  const [inicioOk, fimOk] = swapIfNeeded(normISO(inicio), normISO(fim));
  const canApply =
    selectedCount > 0 &&
    !!normalizeCode(codigo) &&
    (!usePeriod || (!!inicioOk && !!fimOk));

  // ===== Drag handlers =====
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function startDrag(e) {
    if (saving) return;
    // só botão esquerdo ou pointer primário
    if (e.button != null && e.button !== 0) return;

    const root = modalRef.current;
    if (!root) return;

    const r = root.getBoundingClientRect();

    // se ainda estava centralizado, fixa a posição atual como base
    const left = pos?.left ?? r.left;
    const top = pos?.top ?? r.top;

    dragRef.current.dragging = true;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startLeft = left;
    dragRef.current.startTop = top;

    // garante que o modal continue recebendo eventos mesmo fora dele
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    // evita seleção de texto ao arrastar
    e.preventDefault();
  }

  function moveDrag(e) {
    if (!dragRef.current.dragging) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const root = modalRef.current;
    if (!root) return;

    const r = root.getBoundingClientRect();
    const w = r.width;
    const h = r.height;

    const margin = 8;
    const maxLeft = window.innerWidth - w - margin;
    const maxTop = window.innerHeight - h - margin;

    const nextLeft = clamp(dragRef.current.startLeft + dx, margin, Math.max(margin, maxLeft));
    const nextTop = clamp(dragRef.current.startTop + dy, margin, Math.max(margin, maxTop));

    setPos({ left: nextLeft, top: nextTop });
    e.preventDefault();
  }

  function endDrag(e) {
    if (!dragRef.current.dragging) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    dragRef.current.dragging = false;
    dragRef.current.pointerId = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  return (
    <div
      className="lse-backdrop"
      role="dialog"
      aria-modal="true"
      // bloqueia clique no fundo (não fecha ao clicar fora; se quiser fechar, posso mudar)
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={modalRef}
        className="lse-modal"
        style={{
          width: "min(760px, 96vw)",
          // centralizado quando pos=null; vira “absoluto” quando arrasta
          position: "fixed",
          left: pos?.left ?? "50%",
          top: pos?.top ?? "50%",
          transform: pos ? "none" : "translate(-50%, -50%)",
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: 14,
        }}
        // impede que um click no modal seja interpretado como click no backdrop
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER = alça de arraste */}
        <div
          className="lse-head"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            cursor: saving ? "default" : "move",
            userSelect: "none",
            touchAction: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
          title="Arraste para mover"
        >
          <div className="lse-title" style={{ fontWeight: 700 }}>
            Editar célula(s)
          </div>

          <button
            type="button"
            className="lse-close"
            onClick={() => (!saving ? onClose?.() : null)}
            title="Fechar (Esc)"
            disabled={saving}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 20,
              lineHeight: "20px",
            }}
          >
            ×
          </button>
        </div>

        <div className="lse-right" style={{ padding: 14, background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            Selecionadas: <b>{selectedCount}</b>
          </div>

          <div className="lse-grid">
            <label className="lse-field lse-span2">
              <span>Código (Legenda)</span>
              <select value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={saving}>
                <option value="">— selecione —</option>
                {options.map((o) => (
                  <option key={o.codigo} value={o.codigo}>
                    {o.codigo} — {o.desc || "(sem descrição)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="lse-field lse-span2">
              <span>Comentário (Observação)</span>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                disabled={saving}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 10,
                  resize: "vertical",
                }}
                placeholder="Opcional. Será aplicado em batelada nas células selecionadas (ou no período, se marcado)."
              />
            </label>
          </div>

          {/* Aplicar em período */}
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={usePeriod}
                onChange={(e) => setUsePeriod(e.target.checked)}
                disabled={saving}
              />
              <span>
                <b>Aplicar em período</b>{" "}
                <span style={{ color: "#6b7280", fontSize: 12 }}>
                  (para o(s) funcionário(s) selecionados)
                </span>
              </span>
            </label>

            {usePeriod && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginTop: 10,
                  alignItems: "end",
                }}
              >
                <label className="lse-field">
                  <span>Início</span>
                  <input
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    disabled={saving}
                  />
                </label>

                <label className="lse-field">
                  <span>Fim</span>
                  <input
                    type="date"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                    disabled={saving}
                  />
                </label>

                <label style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={somenteUteis}
                    onChange={(e) => setSomenteUteis(e.target.checked)}
                    disabled={saving}
                  />
                  <span>Apenas dias úteis</span>
                </label>

                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#6b7280" }}>
                  Funcionários afetados: <b>{selectedEmployeesCount || 0}</b>
                  {!inicioOk || !fimOk ? (
                    <span style={{ marginLeft: 10, color: "#b91c1c" }}>Informe início e fim.</span>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className="lse-actions" style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              disabled={!canApply || saving}
              onClick={async () => {
                const cod = normalizeCode(codigo);
                const [a, b] = swapIfNeeded(normISO(inicio), normISO(fim));

                setSaving(true);
                try {
                  await onApply?.({
                    codigo: cod,
                    observacao: obs,
                    period: usePeriod ? { inicio: a, fim: b, somenteUteis } : null,
                  });
                  onClose?.();
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Salvando..." : "Aplicar"}
            </button>

            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            Dica: Ctrl+Clique para multiseleção. Shift+Clique para intervalo na mesma linha.
          </div>
        </div>
      </div>
    </div>
  );
}
