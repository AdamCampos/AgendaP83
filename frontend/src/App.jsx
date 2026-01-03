import { useEffect, useMemo, useRef, useState } from "react";

import EmployeeList from "./components/EmployeeList.jsx";
import ScheduleGrid from "./components/ScheduleGrid.jsx";
import LegendStyleEditor from "./components/LegendStyleEditor.jsx";

import { useDebounce } from "./hooks/useDebounce.js";
import { useFuncionarios } from "./hooks/useFuncionarios.js";
import { useGroupEmployees } from "./hooks/useGroupEmployees.js";

import { apiGet, apiPost } from "./lib/api.js";
import { normalizeCalendar, isoAddDays, isoToday, pickDateFromObject, brToIso, isIsoLike } from "./lib/dateUtils.js";
import { setDiff, mapMerge, purgeMapByKeysPrefix, purgeSetByKeysPrefix } from "./lib/collectionUtils.js";
import { CODE_STYLES_STORAGE_KEY, DEFAULT_CODE_LABELS, DEFAULT_CODE_STYLES, buildCodeCss, normalizeCode } from "./lib/codeStyles.js";

import "./App.css";
import "./Grid.css";
import "./Cells.css";
import "./CodeStyles.css";

function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

function filterEmployees(list, q) {
  const term = norm(q);
  if (!term) return list;

  const tokens = term.split(/[,\s]+/).filter(Boolean);

  return (Array.isArray(list) ? list : []).filter((f) => {
    const hay = norm(
      `${f?.Nome ?? ""} ${f?.Chave ?? ""} ${f?.Matricula ?? ""} ${f?.Funcao ?? ""}`
    );
    return tokens.every((t) => hay.includes(t));
  });
}


export default function App() {
  const GROUPS = [
    "SUEIN", "SUMEC", "SUPROD", "SUEMB",
    "COMAN", "COEMB", "COPROD",
    "ADM", "ENGENHARIA",
    "GERENTES",
  ];
  const GROUP_PLAN = useMemo(() => {

    return (groupName) => {
      // Supervisores: inclui eles mesmos + subordinados
      if (["SUEIN", "SUMEC", "SUPROD", "SUEMB"].includes(groupName)) {
        return {
          baseGroups: [groupName],   // carrega supervisores + subordinados
          roleIncludes: [],          // nada extra
        };
      }

      // Coordenadores: inclui o coordenador + “tudo do(s) grupo(s) base”
      if (groupName === "COMAN") {
        return { baseGroups: ["SUEIN", "SUMEC"], roleIncludes: ["COMAN"] };
      }
      if (groupName === "COEMB") {
        return { baseGroups: ["SUEMB"], roleIncludes: ["COEMB"] };
      }
      if (groupName === "COPROD") {
        return { baseGroups: ["SUPROD"], roleIncludes: ["COPROD"] };
      }

      // Administrativo
      if (groupName === "ADM") {
        return { baseGroups: [], roleIncludes: ["ADM"] };
      }
      if (groupName === "ENGENHARIA") {
        return { baseGroups: [], roleIncludes: ["ENG"] };
      }

      // Gerentes: um botão que traz GEPLAT + GEOP
      if (groupName === "GERENTES") {
        return { baseGroups: [], roleIncludes: ["GEPLAT", "GEOP"] };
      }

      return { baseGroups: [], roleIncludes: [] };
    };
  }, []);


  // ✅ preencha com seus supervisores (SQL: WHERE Funcao='...') — já coloquei SUEIN
  const FALLBACK_SUPERVISORS_BY_GROUP = {
    SUEIN: ["FRCF", "NVBN", "RWEU", "WVY4", "YT3I"],
    SUMEC: [],
    SUPROD: [],
    SUEMB: [],
  };


  // ===== status/back-end =====
  const [status, setStatus] = useState("verificando...");
  const [backendOk, setBackendOk] = useState(false);

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

  // ===== datas =====
  const today = useRef(isoToday());
  const [inicio, setInicio] = useState(isoAddDays(today.current, -7));
  const [fim, setFim] = useState(isoAddDays(today.current, 21));

  // ===== busca/lateral =====
  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q, 250);
  const [somenteSelecionados, setSomenteSelecionados] = useState(false);

  // ===== funcionários (modo normal) =====
  const {
    funcionarios,
    rowOrder,
    setRowOrder,
    loadFuncionarios,
    funcionariosByKey,
  } = useFuncionarios({ apiGet, backendOk, qDebounced });

  // ===== modo "grupo" (subordinados via hierarquia) =====
  const {
    activeGroup,
    groupEmployees,
    groupLoading,
    groupError,
    pickGroup,
  } = useGroupEmployees({
    apiGet,
    funcionariosByKey,
    fallbackSupervisorsByGroup: FALLBACK_SUPERVISORS_BY_GROUP,
    groupPlan: GROUP_PLAN, // ✅ novo
  });



  // lista exibida no EmployeeList
  const listForSidebarBase = groupEmployees ?? funcionarios;

  const listForSidebar = useMemo(() => {
    return filterEmployees(listForSidebarBase, q);
  }, [listForSidebarBase, q]);


  // ===== seleção/grid =====
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [gridKeys, setGridKeys] = useState(() => new Set());

  function toggleSelectKey(k) {
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  function selectAllFromSidebar() {
    const keys = listForSidebar
      .map((f) => String(f?.Chave ?? "").trim())
      .filter(Boolean);

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }

  function removeFromGrid(k) {
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      s.delete(k);
      return s;
    });
  }

  // ✅ ao trocar grupo: limpa seleção e busca; e o hook já limpa a lista imediatamente
  function handlePickGroup(g) {
    clearSelection();
    setQ("");
    setSomenteSelecionados(false);
    pickGroup(g);
  }

  // ===== agenda =====
  const [rawCalendar, setRawCalendar] = useState([]);
  const [legenda, setLegenda] = useState([]);
  const [agendaMap, setAgendaMap] = useState(() => new Map());
  const [deletedCells, setDeletedCells] = useState(() => new Set());

  const [sort, setSort] = useState({ col: null, dir: null });
  function cycleSort(col) {
    setSort((prev) => {
      let next;
      if (prev.col !== col) next = { col, dir: "asc" };
      else if (prev.dir === "asc") next = { col, dir: "desc" };
      else next = { col: null, dir: null };
  
      if (next.col && next.dir) {
        setRowOrder((ro) => applySortToRowOrder(ro, next, gridKeys, funcionariosByKey));
      }
  
      return next;
    });
  }
  

  function clearSort() {
    setSort({ col: null, dir: null });
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
      let dt = typeof dtRaw === "string" ? dtRaw : pickDateFromObject(dtRaw) ?? "";
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

    try {
      const { rawCalendar: calRaw, legenda: leg, agendaMap: m, rowsCount } =
        await fetchAgendaForKeys(chaves);

      setRawCalendar(calRaw);
      setLegenda(leg);
      setAgendaMap(m);

      setStatus(`Agenda carregada ✅ (${rowsCount} eventos)`);
    } catch (e) {
      console.error("Falha ao carregar agenda:", e);
      setStatus(`Falha ao carregar agenda ❌ ${e?.message ?? String(e)}`);
    }
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

  // incremental: ao alterar seleção, busca agenda só das chaves novas
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
  }, [selectedKeys, backendOk]); // intencional

  const calendar = useMemo(() => normalizeCalendar(rawCalendar, inicio, fim), [rawCalendar, inicio, fim]);

  const gridKeyList = useMemo(() => Array.from(gridKeys), [gridKeys]);

  const orderedKeys = useMemo(() => {
    const base = rowOrder.length
      ? rowOrder.filter((k) => gridKeys.has(k))
      : gridKeyList;
  
    return base;
  }, [rowOrder, gridKeys, gridKeyList]);
  

  const visibleKeys = useMemo(() => {
    if (!somenteSelecionados) return orderedKeys;
    return orderedKeys.filter((k) => selectedKeys.has(k));
  }, [orderedKeys, selectedKeys, somenteSelecionados]);

  // header info para o grid
  const headerInfo = useMemo(() => {
    const days = calendar.map((iso) => {
      const d = new Date(iso + "T00:00:00");
      const day = String(d.getDate()).padStart(2, "0");
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
        groups.push({ monthKey: item.monthKey, monthLabel: item.monthLabel, count: 1 });
      } else last.count++;
    }

    return { days, groups };
  }, [calendar]);

  // ===== estilos da legenda (persistência local) =====
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [styleEditorCode, setStyleEditorCode] = useState("");

  const [codeStyles, setCodeStyles] = useState(() => {
    try {
      const raw = localStorage.getItem(CODE_STYLES_STORAGE_KEY);
      if (!raw) return DEFAULT_CODE_STYLES;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CODE_STYLES, ...(parsed || {}) };
    } catch {
      return DEFAULT_CODE_STYLES;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CODE_STYLES_STORAGE_KEY, JSON.stringify(codeStyles));
    } catch { }
  }, [codeStyles]);

  const dynamicCodeCss = useMemo(() => buildCodeCss(codeStyles), [codeStyles]);

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

  function applySortToRowOrder(prevRowOrder, nextSort, gridKeys, funcionariosByKey) {
    if (!nextSort?.col || !nextSort?.dir) return prevRowOrder;
  
    const dir = nextSort.dir === "desc" ? -1 : 1;
    const col = nextSort.col;
  
    const getVal = (k) => {
      const f = funcionariosByKey.get(k) || {};
      if (col === "Chave") return String(k ?? "");
      if (col === "Funcao") return String(f.Funcao ?? "");
      if (col === "Matricula") return String(f.Matricula ?? "");
      if (col === "Nome") return String(f.Nome ?? "");
      if (col === "Quant") return String(f.Quant ?? "");
      return "";
    };
  
    // pega só os que estão no grid, preservando os demais
    const inGrid = prevRowOrder.filter((k) => gridKeys.has(k));
    const inGridSet = new Set(inGrid);
  
    // se existir algum key no grid que não está no rowOrder ainda, inclui
    const missing = Array.from(gridKeys).filter((k) => !inGridSet.has(k));
    const base = [...inGrid, ...missing];
  
    base.sort((a, b) => {
      const va = getVal(a).toLocaleUpperCase("pt-BR");
      const vb = getVal(b).toLocaleUpperCase("pt-BR");
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  
    const rest = prevRowOrder.filter((k) => !gridKeys.has(k));
    return [...base, ...rest];
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
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>

          <div className="control">
            <label>Fim</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>

          <div className="control" style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={carregarAgenda}
              disabled={!backendOk || selectedKeys.size === 0}
              title={selectedKeys.size === 0 ? "Selecione funcionários para carregar" : "Carregar agenda dos selecionados"}
            >
              Carregar agenda
            </button>
          </div>
        </div>
      </div>

      <div className="layout">
        <EmployeeList
          q={q}
          setQ={setQ}
          funcionarios={listForSidebar}
          selectedKeys={selectedKeys}
          toggleSelectKey={toggleSelectKey}
          somenteSelecionados={somenteSelecionados}
          setSomenteSelecionados={setSomenteSelecionados}
          selectAll={selectAllFromSidebar}
          clearSelection={clearSelection}
          onRefreshEmployees={() => {
            if (activeGroup) return handlePickGroup(activeGroup);
            return loadFuncionarios().catch(() => setStatus("Falha ao carregar funcionários ❌"));
          }}
          onRepor={repor}
          groups={GROUPS}
          activeGroup={activeGroup}
          onPickGroup={handlePickGroup}
          groupLoading={groupLoading}
          groupError={groupError}
        />

        <main className="content">
          <div className="content-header">
            <div className="h">Escala ({calendar.length} dias) — Linhas: {visibleKeys.length}</div>
            <div className="status">
              Dica: <b>Alt+Clique</b> numa célula = excluir/reincluir (local). • Arraste ⠿ • × remove • Duplo clique = editar
            </div>
          </div>

          <div className="legend">
            <span>Legenda:</span>

            {legendTags.length === 0 ? (
              <span className="legend-muted">(carregue agenda para ver legenda)</span>
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
                    onClick={() => openStyleEditorFor(legendTags[0]?.codigo || "FS")}
                  >
                    Editar estilos…
                  </button>

                  {unknownCodes.length > 0 ? (
                    <span className="legend-warn">
                      Sem estilo: <b>{unknownCodes.join(", ")}</b>
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
