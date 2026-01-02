export const CODE_STYLES_STORAGE_KEY = "agendaP83.codeStyles.v1";

export const DEFAULT_CODE_LABELS = {
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

export const DEFAULT_CODE_STYLES = {
  FS: { mode: "solid", bg1: "#92D050", bg2: "", fg: "#000000", bold: true },
  B: { mode: "solid", bg1: "#00B050", bg2: "", fg: "#000000", bold: true },
  F: { mode: "solid", bg1: "#FFC000", bg2: "", fg: "#000000", bold: true },
  YNT: { mode: "solid", bg1: "#FF9900", bg2: "", fg: "#000000", bold: true },
  HO: { mode: "solid", bg1: "#00B0F0", bg2: "", fg: "#000000", bold: true },
  BT: { mode: "solid", bg1: "#00A99D", bg2: "", fg: "#000000", bold: true },
  PY: { mode: "solid", bg1: "#00B0F0", bg2: "", fg: "#000000", bold: true },
  ANG: { mode: "solid", bg1: "#FFFF00", bg2: "", fg: "#000000", bold: true },
  SGP: { mode: "solid", bg1: "#FF4D4D", bg2: "", fg: "#000000", bold: true },
  NTG: { mode: "solid", bg1: "#FF66CC", bg2: "", fg: "#000000", bold: true },
  TR: { mode: "solid", bg1: "#F8CBAD", bg2: "", fg: "#000000", bold: true },
  V: { mode: "solid", bg1: "#D9E1F2", bg2: "", fg: "#000000", bold: true },
  O: { mode: "solid", bg1: "#D9D9D9", bg2: "", fg: "#000000", bold: true },
  OH: { mode: "solid", bg1: "#D9D9D9", bg2: "", fg: "#000000", bold: true },
  A: { mode: "solid", bg1: "#C00000", bg2: "", fg: "#FFFFFF", bold: true },
  EM: { mode: "solid", bg1: "#B4C6E7", bg2: "", fg: "#000000", bold: true },
  EVT: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },

  DR3T: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  DR6T: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  HZH1: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  HZH2: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  HZH3: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  HZPR: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  HZUT: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },

  PUN: { mode: "gradient", bg1: "#C00000", bg2: "#00B0F0", fg: "#FFFFFF", bold: true },

  HOE: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  IN: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  IO: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  L: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  NB: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  PT: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  TUY: { mode: "solid", bg1: "#D9D9D9", bg2: "", fg: "#000000", bold: true },
  "0": { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
};

export function normalizeCode(code) {
  const c = String(code ?? "").trim();
  return c ? c : "";
}

export function buildCodeCss(styleMap) {
  const entries = Object.entries(styleMap || {});
  const lines = [];

  for (const [rawCode, st] of entries) {
    const code = normalizeCode(rawCode);
    if (!code) continue;

    const mode = st?.mode === "gradient" ? "gradient" : "solid";
    const bg1 = st?.bg1 || "#ffffff";
    const bg2 = st?.bg2 || "#ffffff";
    const fg = st?.fg || "#000000";
    const bold = !!st?.bold;

    const borderW = Number.isFinite(Number(st?.borderW))
      ? Math.max(0, Math.min(8, Number(st.borderW)))
      : 0;
    const borderC = st?.borderC || "#000000";
    const inset =
      borderW > 0
        ? `box-shadow: inset 0 0 0 ${borderW}px ${borderC} !important;`
        : "";

    const selector = `.code-${CSS.escape(code)}`;
    const background =
      mode === "gradient"
        ? `linear-gradient(to bottom, ${bg1} 0%, ${bg2} 100%)`
        : `${bg1}`;

    lines.push(
      `${selector}{background:${background} !important;color:${fg} !important;font-weight:${
        bold ? 800 : 600
      } !important;${inset}}`
    );
  }

  return lines.join("\n");
}
