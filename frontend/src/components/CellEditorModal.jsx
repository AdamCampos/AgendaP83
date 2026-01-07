import { useEffect, useMemo, useState } from "react";

function normalizeCode(v) {
  return String(v ?? "").trim().toUpperCase();
}

export default function CellEditorModal({
  open,
  selectedCount,
  legenda,          // array do /api/legenda (Codigo/Descricao ou Codigo/Nome)
  defaultCodigo,    // codigo sugerido (opcional)
  defaultObs,       // obs sugerida (opcional)
  onClose,
  onApply,          // ({ codigo, observacao }) => Promise<void>
}) {
  const options = useMemo(() => {
    const list = Array.isArray(legenda) ? legenda : [];

    return list
      .map((x) => {
        const codigo = normalizeCode(x?.Codigo);
        const desc = String(x?.Descricao ?? x?.Nome ?? "").trim();

        // ✅ Se Ativo não vier, assume true.
        const ativo = x?.Ativo == null ? true : !!x?.Ativo;

        return {
          codigo,
          desc,
          tipo: String(x?.Tipo ?? "").trim(),
          ativo,
        };
      })
      .filter((x) => x.codigo && x.ativo)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
  }, [legenda]);

  const [codigo, setCodigo] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCodigo(defaultCodigo ? normalizeCode(defaultCodigo) : "");
    setObs(String(defaultObs ?? ""));
    setSaving(false);
  }, [open, defaultCodigo, defaultObs]);

  if (!open) return null;

  const canApply = selectedCount > 0 && codigo;

  return (
    <div className="lse-backdrop" role="dialog" aria-modal="true">
      <div className="lse-modal" style={{ width: "min(720px, 96vw)" }}>
        <div className="lse-head">
          <div className="lse-title">Editar célula(s)</div>
          <button type="button" className="lse-close" onClick={onClose} title="Fechar">
            ×
          </button>
        </div>

        <div className="lse-right" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            Selecionadas: <b>{selectedCount}</b>
          </div>

          <div className="lse-grid">
            <label className="lse-field lse-span2">
              <span>Código (Legenda)</span>
              <select value={codigo} onChange={(e) => setCodigo(e.target.value)}>
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
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 10,
                  resize: "vertical",
                }}
                placeholder="Opcional. Será aplicado em batelada nas células selecionadas."
              />
            </label>
          </div>

          <div className="lse-actions">
            <button
              type="button"
              className="btn"
              disabled={!canApply || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onApply?.({ codigo: normalizeCode(codigo), observacao: obs });
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
