import { useEffect, useMemo, useRef, useState } from "react";
import EmployeeList from "./components/EmployeeList.jsx";
import ScheduleGrid from "./components/ScheduleGrid.jsx";
import LegendStyleEditor from "./components/LegendStyleEditor.jsx";
import { useDebounce } from "./hooks/useDebounce.js";
import { apiGet, apiPost } from "./lib/api.js";

import "./App.css";
import "./Grid.css";
import "./Cells.css";
import "./CodeStyles.css";

/* ===== datas ===== */
function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function isoToday() {
  return toIsoDate(new Date());
}
function isoAddDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}
function isoRange(inicio, fim) {
  const a = new Date(inicio + "T00:00:00");
  const b = new Date(fim + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return [];
  const out = [];
  const cur = new Date(a);
  while (cur <= b) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
    if (out.length > 800) break;
  }
  return out;
}
function isIsoLike(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
}
function brToIso(s) {
  const m =
    typeof s === "string" ? s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function pickDateFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  return (
    obj.Data ||
    obj.data ||
    obj.Dia ||
    obj.dia ||
    obj.Date ||
    obj.date ||
    obj.Value ||
    obj.value ||
    null
  );
}
function normalizeCalendar(rawCalendar, inicio, fim) {
  const fallback = isoRange(inicio, fim);
  if (!Array.isArray(rawCalendar) || rawCalendar.length === 0) return fallback;

  const normalized = [];
  for (const item of rawCalendar) {
    let v = null;
    if (typeof item === "string") v = item;
    else if (item && typeof item === "object") v = pickDateFromObject(item);

    if (!v) continue;
    if (typeof v === "string" && v.includes("T")) v = v.slice(0, 10);

    if (isIsoLike(v)) normalized.push(v.slice(0, 10));
    else {
      const br = brToIso(v);
      if (br) normalized.push(br);
      else {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) normalized.push(toIsoDate(d));
      }
    }
  }

  const uniq = Array.from(new Set(normalized)).sort();
  return uniq.length ? uniq : fallback;
}

/* ===== helpers Set/Map ===== */
// Defaults (sigla -> significado)
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

function setDiff(a, b) {
  const out = new Set();
  for (const x of a) if (!b.has(x)) out.add(x);
  return out;
}
function mapMerge(oldMap, newMap) {
  const m = new Map(oldMap);
  for (const [k, v] of newMap.entries()) m.set(k, v);
  return m;
}
function purgeMapByKeysPrefix(map, keys) {
  if (!keys || keys.length === 0) return map;
  const prefixes = keys.map((k) => `${k}|`);
  const out = new Map();
  for (const [kk, vv] of map.entries()) {
    let keep = true;
    for (const p of prefixes) {
      if (String(kk).startsWith(p)) {
        keep = false;
        break;
      }
    }
    if (keep) out.set(kk, vv);
  }
  return out;
}
function purgeSetByKeysPrefix(set, keys) {
  if (!keys || keys.length === 0) return set;
  const prefixes = keys.map((k) => `${k}|`);
  const out = new Set();
  for (const kk of set.values()) {
    let keep = true;
    for (const p of prefixes) {
      if (String(kk).startsWith(p)) {
        keep = false;
        break;
      }
    }
    if (keep) out.add(kk);
  }
  return out;
}

/* ===== estilos default por código ===== */
const DEFAULT_CODE_STYLES = {
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
  PUN: {
    mode: "gradient",
    bg1: "#C00000",
    bg2: "#00B0F0",
    fg: "#FFFFFF",
    bold: true,
  },
  HOE: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  IN: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  IO: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  L: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  NB: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  PT: { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
  TUY: { mode: "solid", bg1: "#D9D9D9", bg2: "", fg: "#000000", bold: true },
  "0": { mode: "solid", bg1: "#FFFFFF", bg2: "", fg: "#000000", bold: true },
};

function normalizeCode(code) {
  const c = String(code ?? "").trim();
  if (!c) return "";
  return c;
}

function buildCodeCss(styleMap) {
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

export default function App() {
  const [status, setStatus] = useState("verificando...");
  const [backendOk, setBackendOk] = useState(false);

  const today = useRef(isoToday());
  const [inicio, setInicio] = useState(isoAddDays(today.current, -7));
  const [fim, setFim] = useState(isoAddDays(today.current, 21));

  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q, 250);

  const [somenteSelecionados, setSomenteSelecionados] = useState(true);

  const [funcionarios, setFuncionarios] = useState([]);
  const [funcCache, setFuncCache] = useState(() => new Map());

  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [gridKeys, setGridKeys] = useState(new Set());

  const [rawCalendar, setRawCalendar] = useState([]);
  const [legenda, setLegenda] = useState([]);
  const [agendaMap, setAgendaMap] = useState(new Map());

  const [deletedCells, setDeletedCells] = useState(new Set());
  const [rowOrder, setRowOrder] = useState([]);

  const [sort, setSort] = useState({ col: null, dir: null });
  function cycleSort(col) {
    setSort((prev) => {
      if (prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  }
  function clearSort() {
    setSort({ col: null, dir: null });
  }

  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [styleEditorCode, setStyleEditorCode] = useState("");

  const [codeStyles, setCodeStyles] = useState(() => {
    try {
      const raw = localStorage.getItem("agendaP83.codeStyles.v1");
      if (!raw) return DEFAULT_CODE_STYLES;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CODE_STYLES, ...(parsed || {}) };
    } catch {
      return DEFAULT_CODE_STYLES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("agendaP83.codeStyles.v1", JSON.stringify(codeStyles));
    } catch {
      // ignore
    }
  }, [codeStyles]);

  const dynamicCodeCss = useMemo(() => buildCodeCss(codeStyles), [codeStyles]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(() => {
        setBackendOk(true);
        setStatus("Backend conectado ✅");
      })
      .catch(() => {
        setBackendOk(false);
        setStatus("Backend NÃO respondeu ❌");
      });
  }, []);

  async function loadFuncionarios() {
    const params = new URLSearchParams();
    if (qDebounced.trim()) params.set("q", qDebounced.trim());
    const data = await apiGet(`/api/funcionarios?${params.toString()}`);
    const list = Array.isArray(data) ? data : [];
    setFuncionarios(list);

    setFuncCache((prev) => {
      const next = new Map(prev);
      for (const f of list) {
        const k = String(f?.Chave ?? "").trim();
        if (k) next.set(k, f);
      }
      return next;
    });

    setRowOrder((prev) => {
      const keys = list.map((f) => String(f.Chave ?? "").trim()).filter(Boolean);
      if (prev.length === 0) return keys;
      const prevSet = new Set(prev);
      return [...prev, ...keys.filter((k) => !prevSet.has(k))];
    });
  }

  async function fetchAgendaForKeys(chaves) {
    const params = new URLSearchParams();
    params.set("inicio", inicio);
    params.set("fim", fim);
    params.set("chaves", chaves.join(","));

    const combo = await apiGet(`/api/agenda?${params.toString()}`);

    const nextRawCal = Array.isArray(combo?.calendario) ? combo.calendario : [];
    const nextLegenda = Array.isArray(combo?.legenda) ? combo.legenda : [];

    const rows = Array.isArray(combo?.agendaDia) ? combo.agendaDia : [];
    const m = new Map();

    for (const r of rows) {
      const fk = String(r.FuncionarioChave ?? "").trim();
      let dtRaw = r.Data;
      let dt =
        typeof dtRaw === "string" ? dtRaw : pickDateFromObject(dtRaw) ?? "";
      if (typeof dt === "string" && dt.includes("T")) dt = dt.slice(0, 10);
      if (!isIsoLike(dt)) {
        const br = brToIso(dt);
        if (br) dt = br;
      }
      if (!fk || !dt) continue;
      m.set(`${fk}|${dt}`, r);
    }

    return {
      rawCalendar: nextRawCal,
      legenda: nextLegenda,
      agendaMap: m,
      rowsCount: rows.length,
    };
  }

  async function carregarAgenda() {
    const chaves = Array.from(selectedKeys).filter(Boolean);
    if (chaves.length === 0) {
      setAgendaMap(new Map());
      setRawCalendar([]);
      setLegenda([]);
      setStatus("Selecione funcionários para carregar a agenda.");
      return;
    }

    setStatus("Carregando agenda...");
    const { rawCalendar: calRaw, legenda: leg, agendaMap: m, rowsCount } =
      await fetchAgendaForKeys(chaves);

    setRawCalendar(calRaw);
    setLegenda(leg);
    setAgendaMap(m);
    setStatus(`Agenda carregada ✅ (${rowsCount} eventos)`);
  }

  function repor() {
    setSelectedKeys(new Set());
    setGridKeys(new Set());
    setAgendaMap(new Map());
    setLegenda([]);
    setRawCalendar([]);
    setDeletedCells(new Set());
    setSort({ col: null, dir: null });
    setStatus("Reposto ✅ (seleção e grid limpas)");
  }

  useEffect(() => {
    if (!backendOk) {
      setGridKeys(new Set(selectedKeys));
      return;
    }

    const next = new Set(selectedKeys);
    const prev = gridKeys;

    const added = Array.from(setDiff(next, prev));
    const removed = Array.from(setDiff(prev, next));

    if (removed.length) {
      setAgendaMap((m) => purgeMapByKeysPrefix(m, removed));
      setDeletedCells((s) => purgeSetByKeysPrefix(s, removed));
    }

    setGridKeys(next);

    if (added.length) {
      (async () => {
        try {
          const { rawCalendar: calRaw, legenda: leg, agendaMap: m } =
            await fetchAgendaForKeys(added);

          setRawCalendar((prevRaw) => (prevRaw?.length ? prevRaw : calRaw));
          setLegenda((prevLeg) => (prevLeg?.length ? prevLeg : leg));
          setAgendaMap((prevMap) => mapMerge(prevMap, m));
        } catch {
          setStatus("Falha ao buscar agenda incremental ❌");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKeys, backendOk]);

  useEffect(() => {
    if (!backendOk) return;
    loadFuncionarios().catch(() => setStatus("Falha ao carregar funcionários ❌"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendOk, qDebounced]);

  const calendar = useMemo(
    () => normalizeCalendar(rawCalendar, inicio, fim),
    [rawCalendar, inicio, fim]
  );

  const funcionariosByKey = useMemo(() => {
    const map = new Map(funcCache);
    for (const f of funcionarios) {
      const k = String(f?.Chave ?? "").trim();
      if (k) map.set(k, f);
    }
    return map;
  }, [funcCache, funcionarios]);

  const gridKeyList = useMemo(() => Array.from(gridKeys), [gridKeys]);

  const orderedKeys = useMemo(() => {
    const base = rowOrder.length
      ? rowOrder.filter((k) => gridKeys.has(k))
      : gridKeyList;

    if (!sort?.col || !sort?.dir) return base;

    const dir = sort.dir === "desc" ? -1 : 1;
    const col = sort.col;

    const getVal = (k) => {
      const f = funcionariosByKey.get(k) || {};
      if (col === "Chave") return String(k ?? "");
      if (col === "Funcao") return String(f.Funcao ?? "");
      if (col === "Matricula") return String(f.Matricula ?? "");
      if (col === "Nome") return String(f.Nome ?? "");
      if (col === "Quant") return String(f.Quant ?? "");
      return "";
    };

    const copy = [...base];
    copy.sort((a, b) => {
      const va = getVal(a).toLocaleUpperCase("pt-BR");
      const vb = getVal(b).toLocaleUpperCase("pt-BR");
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return copy;
  }, [rowOrder, gridKeys, gridKeyList, sort, funcionariosByKey]);

  const visibleKeys = useMemo(() => {
    if (!somenteSelecionados) return orderedKeys;
    return orderedKeys.filter((k) => selectedKeys.has(k));
  }, [orderedKeys, selectedKeys, somenteSelecionados]);

  const legendTags = useMemo(() => {
    return (Array.isArray(legenda) ? legenda : [])
      .slice(0, 48)
      .map((l, idx) => ({
        key: `${String(l.Codigo ?? "").trim()}-${idx}`,
        codigo: String(l.Codigo ?? "").trim(),
        nome: String(l.Nome ?? "").trim(),
      }))
      .filter((x) => x.codigo);
  }, [legenda]);

  const unknownCodes = useMemo(() => {
    const set = new Set();
    for (const t of legendTags) {
      const c = normalizeCode(t.codigo);
      if (!c) continue;
      if (!codeStyles[c]) set.add(c);
    }
    return Array.from(set).sort();
  }, [legendTags, codeStyles]);

  const headerInfo = useMemo(() => {
    const days = calendar.map((iso) => {
      const d = new Date(iso + "T00:00:00");

      const day = String(d.getDate()).padStart(2, "0");
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const monthLabel = d
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(".", "");

      const isMonthStart = d.getDate() === 1;

      return { iso, day, isWeekend, monthKey, monthLabel, isMonthStart };
    });

    const groups = [];
    for (const item of days) {
      const last = groups[groups.length - 1];
      if (!last || last.monthKey !== item.monthKey) {
        groups.push({
          monthKey: item.monthKey,
          monthLabel: item.monthLabel,
          count: 1,
        });
      } else last.count++;
    }

    return { days, groups };
  }, [calendar]);

  function toggleSelectKey(k) {
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  }

  function removeFromGrid(k) {
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      s.delete(k);
      return s;
    });
  }

  function selectAll() {
    const keys = funcionarios
      .map((f) => String(f.Chave ?? "").trim())
      .filter(Boolean);

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  function toggleCellDeleted(cellKey) {
    setDeletedCells((prev) => {
      const s = new Set(prev);
      if (s.has(cellKey)) s.delete(cellKey);
      else s.add(cellKey);
      return s;
    });
  }

  function openStyleEditorFor(code) {
    const c = normalizeCode(code);
    if (!c) return;
    setStyleEditorCode(c);
    setStyleEditorOpen(true);
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: dynamicCodeCss }} />

      <div className="topbar">
        <div className="brand">
          <div className="title">AgendaP83 — Escala</div>
          <div className="subtitle">{status}</div>
        </div>

        <div className="controls">
          <div className="control">
            <label>Início</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>

          <div className="control">
            <label>Fim</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="layout">
        <EmployeeList
          q={q}
          setQ={setQ}
          funcionarios={funcionarios}
          selectedKeys={selectedKeys}
          toggleSelectKey={toggleSelectKey}
          somenteSelecionados={somenteSelecionados}
          setSomenteSelecionados={setSomenteSelecionados}
          selectAll={selectAll}
          clearSelection={clearSelection}
          onRefreshEmployees={loadFuncionarios}
          onLoadAgenda={carregarAgenda}
          onRepor={repor}
        />

        <main className="content">
          <div className="content-header">
            <div className="h">
              Escala ({calendar.length} dias) — Linhas: {visibleKeys.length}
            </div>
            <div className="status">
              Dica: <b>Alt+Clique</b> numa célula = excluir/reincluir (local). •
              Arraste ⠿ • × remove • Duplo clique = editar
            </div>
          </div>

          <div className="legend">
            <span>Legenda:</span>

            {legendTags.length === 0 ? (
              <span className="legend-muted">
                (carregue agenda para ver legenda)
              </span>
            ) : (
              <>
                {legendTags.map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    className={`tag code-${t.codigo}`}
                    title={(t.nome || t.codigo) + "\nClique para editar estilo"}
                    onClick={() => openStyleEditorFor(t.codigo)}
                  >
                    {t.codigo}
                  </button>
                ))}

                <div className="legend-tools">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const first = legendTags[0]?.codigo || "FS";
                      openStyleEditorFor(first);
                    }}
                  >
                    Editar estilos…
                  </button>

                  {unknownCodes.length > 0 ? (
                    <span className="legend-warn">
                      Sem estilo: <b>{unknownCodes.join(", ")}</b> (clique no
                      código para ajustar)
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <ScheduleGrid
            visibleKeys={visibleKeys}
            funcionariosByKey={funcionariosByKey}
            headerInfo={headerInfo}
            agendaMap={agendaMap}
            deletedCells={deletedCells}
            toggleCellDeleted={toggleCellDeleted}
            rowOrder={rowOrder}
            setRowOrder={setRowOrder}
            onRemoveRow={removeFromGrid}
            sort={sort}
            onSort={cycleSort}
            onExitSort={clearSort}
            codeStyles={codeStyles}
            // ✅ edição no grid:
            legenda={legenda}
            apiPost={apiPost}
            setAgendaMap={setAgendaMap}
          />
        </main>
      </div>

      <LegendStyleEditor
        open={styleEditorOpen}
        code={styleEditorCode}
        styles={codeStyles}
        onClose={() => setStyleEditorOpen(false)}
        onChange={(code, nextStyle) => {
          const c = normalizeCode(code);
          if (!c) return;
          setCodeStyles((prev) => ({ ...prev, [c]: nextStyle }));
        }}
        onReset={(code) => {
          const c = normalizeCode(code);
          if (!c) return;
          setCodeStyles((prev) => {
            const next = { ...prev };
            if (DEFAULT_CODE_STYLES[c]) next[c] = DEFAULT_CODE_STYLES[c];
            else delete next[c];
            return next;
          });
        }}
        onCreateMissing={(raw) => {
          const c = normalizeCode(raw);
          if (!c) return;

          setCodeStyles((prev) => {
            if (prev?.[c]) return prev;

            return {
              ...prev,
              [c]: {
                mode: "solid",
                bg1: "#FFFFFF",
                bg2: "#FFFFFF",
                fg: "#000000",
                bold: true,
                borderW: 0,
                borderC: "#000000",
                label: DEFAULT_CODE_LABELS[c] || "",
              },
            };
          });
        }}
        onSelectCode={(c) => {
          const cc = normalizeCode(c);
          if (cc) setStyleEditorCode(cc);
        }}
        knownCodes={Object.keys(codeStyles).sort()}
      />
    </div>
  );
}
