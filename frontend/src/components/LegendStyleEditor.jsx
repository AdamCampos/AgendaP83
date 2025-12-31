import { useEffect, useMemo, useState } from "react";

function normalizeHex(v, fallback = "#FFFFFF") {
  const s = String(v || "").trim();
  if (!s) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  return fallback;
}

function CodeButton({ code, active, onClick }) {
  return (
    <button
      type="button"
      className={"lse-codebtn" + (active ? " active" : "")}
      onClick={onClick}
      title="Selecionar código"
    >
      {code}
    </button>
  );
}

export default function LegendStyleEditor({
  open,
  code,
  styles,
  knownCodes = [],
  onClose,
  onChange,
  onReset,
  onCreateMissing,
}) {
  const mergedKnown = useMemo(() => {
    const set = new Set([...(knownCodes || []), ...(Object.keys(styles || {}) || [])]);
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [knownCodes, styles]);

  const current = styles?.[code] || null;

  const [local, setLocal] = useState(() => ({
    mode: "solid",
    bg1: "#FFFFFF",
    bg2: "#FFFFFF",
    fg: "#000000",
    bold: true,
  }));

  useEffect(() => {
    if (!open) return;
    const st = styles?.[code];
    if (!st) {
      setLocal({
        mode: "solid",
        bg1: "#FFFFFF",
        bg2: "#FFFFFF",
        fg: "#000000",
        bold: true,
      });
      return;
    }
    setLocal({
      mode: st.mode === "gradient" ? "gradient" : "solid",
      bg1: normalizeHex(st.bg1, "#FFFFFF"),
      bg2: normalizeHex(st.bg2, "#FFFFFF"),
      fg: normalizeHex(st.fg, "#000000"),
      bold: !!st.bold,
    });
  }, [open, code, styles]);

  if (!open) return null;

  const ensureExists = () => {
    if (!styles?.[code]) onCreateMissing?.(code);
  };

  const previewStyle =
    local.mode === "gradient"
      ? { background: `linear-gradient(to bottom, ${local.bg1}, ${local.bg2})`, color: local.fg, fontWeight: local.bold ? 800 : 600 }
      : { background: local.bg1, color: local.fg, fontWeight: local.bold ? 800 : 600 };

  return (
    <div className="lse-backdrop" role="dialog" aria-modal="true">
      <div className="lse-modal">
        <div className="lse-head">
          <div className="lse-title">Editar estilo</div>
          <button type="button" className="lse-close" onClick={onClose} title="Fechar">
            ×
          </button>
        </div>

        <div className="lse-body">
          <div className="lse-left">
            <div className="lse-section-title">Códigos</div>
            <div className="lse-codelist">
              {mergedKnown.map((c) => (
                <CodeButton
                  key={c}
                  code={c}
                  active={c === code}
                  onClick={() => {
                    onCreateMissing?.(c);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="lse-right">
            <div className="lse-row">
              <div className="lse-section-title">
                Código: <b>{code}</b>
              </div>

              <div className="lse-preview" style={previewStyle} title="Preview">
                {code}
              </div>
            </div>

            {!current ? (
              <div className="lse-warn">
                Esse código ainda não tem estilo salvo. Clique em “Criar” para começar.
              </div>
            ) : null}

            <div className="lse-grid">
              <label className="lse-field">
                <span>Modo</span>
                <select
                  value={local.mode}
                  onChange={(e) => {
                    ensureExists();
                    setLocal((p) => ({ ...p, mode: e.target.value }));
                  }}
                >
                  <option value="solid">Sólido</option>
                  <option value="gradient">Gradiente (vertical)</option>
                </select>
              </label>

              <label className="lse-field">
                <span>Fundo 1</span>
                <input
                  type="color"
                  value={normalizeHex(local.bg1)}
                  onChange={(e) => {
                    ensureExists();
                    setLocal((p) => ({ ...p, bg1: e.target.value.toUpperCase() }));
                  }}
                />
              </label>

              <label className="lse-field">
                <span>Fundo 2</span>
                <input
                  type="color"
                  value={normalizeHex(local.bg2)}
                  disabled={local.mode !== "gradient"}
                  onChange={(e) => {
                    ensureExists();
                    setLocal((p) => ({ ...p, bg2: e.target.value.toUpperCase() }));
                  }}
                />
              </label>

              <label className="lse-field">
                <span>Fonte</span>
                <input
                  type="color"
                  value={normalizeHex(local.fg, "#000000")}
                  onChange={(e) => {
                    ensureExists();
                    setLocal((p) => ({ ...p, fg: e.target.value.toUpperCase() }));
                  }}
                />
              </label>

              <label className="lse-field lse-check">
                <input
                  type="checkbox"
                  checked={!!local.bold}
                  onChange={(e) => {
                    ensureExists();
                    setLocal((p) => ({ ...p, bold: e.target.checked }));
                  }}
                />
                <span>Negrito</span>
              </label>
            </div>

            <div className="lse-actions">
              {!current ? (
                <button type="button" className="btn btn-secondary" onClick={() => onCreateMissing?.(code)}>
                  Criar
                </button>
              ) : null}

              <button
                type="button"
                className="btn"
                onClick={() => {
                  ensureExists();
                  onChange?.(code, local);
                }}
              >
                Salvar
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onReset?.(code)}
                title="Volta para default (se existir)"
              >
                Reset
              </button>

              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        </div>

        <div className="lse-foot">
          <span>Dica:</span> clique na legenda (na tela) para abrir direto no código.
        </div>
      </div>
    </div>
  );
}
