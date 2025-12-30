import { useEffect, useMemo, useRef, useState } from "react";
import EmployeeList from "./components/EmployeeList.jsx";
import ScheduleGrid from "./components/ScheduleGrid.jsx";
import { apiGet } from "./lib/api.js";
import { useDebounce } from "./hooks/useDebounce.js";

import "./App.css";
import "./Grid.css";

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
    if (out.length > 400) break;
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

export default function App() {
  const [status, setStatus] = useState("verificando...");
  const [backendOk, setBackendOk] = useState(false);

  const today = useRef(isoToday());
  const [inicio, setInicio] = useState(isoAddDays(today.current, -7));
  const [fim, setFim] = useState(isoAddDays(today.current, 21));

  // busca da lateral
  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q, 250);

  // lista lateral (resultado do filtro)
  const [funcionarios, setFuncionarios] = useState([]);

  // selecionados = "quem está na grid"
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  // cache global de funcionários (para o grid nunca perder dados ao filtrar)
  const [funcionariosCache, setFuncionariosCache] = useState(() => new Map());

  // ordem global (nunca deve ser podada pela busca)
  const [rowOrderGlobal, setRowOrderGlobal] = useState([]);

  // agenda
  const [rawCalendar, setRawCalendar] = useState([]);
  const [legenda, setLegenda] = useState([]);
  const [agendaMap, setAgendaMap] = useState(new Map());

  // exclusões locais e dnd
  const [deletedCells, setDeletedCells] = useState(new Set());
  const [somenteSelecionados, setSomenteSelecionados] = useState(true);

  // para detectar add/remove sem depender de “gridKeys” separado
  const prevSelectedRef = useRef(new Set());

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

    // ✅ atualiza cache global (não depende do filtro atual)
    setFuncionariosCache((prev) => {
      const next = new Map(prev);
      for (const f of list) {
        const k = String(f.Chave ?? "").trim();
        if (k) next.set(k, f);
      }
      return next;
    });

    // ✅ rowOrder global: só acrescenta novos (NUNCA remove por causa de busca)
    setRowOrderGlobal((prev) => {
      const s = new Set(prev);
      const incoming = list
        .map((f) => String(f.Chave ?? "").trim())
        .filter(Boolean);

      const appended = incoming.filter((k) => !s.has(k));
      return appended.length ? [...prev, ...appended] : prev;
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

  // ✅ recarrega agenda para TUDO que está na grid (selectedKeys)
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

  // ✅ repor = limpa grid e estruturas
  function repor() {
    setSelectedKeys(new Set());
    setAgendaMap(new Map());
    setLegenda([]);
    setRawCalendar([]);
    setDeletedCells(new Set());
    setStatus("Reposto ✅ (grid limpa)");
    prevSelectedRef.current = new Set();
  }

  // ✅ incremental: marcar/desmarcar atualiza grid e agenda sem depender da busca
  useEffect(() => {
    if (!backendOk) return;

    const prev = prevSelectedRef.current;
    const next = selectedKeys;

    const added = Array.from(setDiff(next, prev));
    const removed = Array.from(setDiff(prev, next));

    // remove imediatamente do que já está carregado
    if (removed.length) {
      setAgendaMap((m) => purgeMapByKeysPrefix(m, removed));
      setDeletedCells((s) => purgeSetByKeysPrefix(s, removed));
    }

    // adiciona incrementalmente (somente das novas chaves)
    if (added.length) {
      (async () => {
        try {
          const { rawCalendar: calRaw, legenda: leg, agendaMap: m } =
            await fetchAgendaForKeys(added);

          // se ainda não tinha calendário/legenda, aproveita do backend
          setRawCalendar((prevRaw) => (prevRaw?.length ? prevRaw : calRaw));
          setLegenda((prevLeg) => (prevLeg?.length ? prevLeg : leg));
          setAgendaMap((prevMap) => mapMerge(prevMap, m));
        } catch {
          setStatus("Falha ao buscar agenda incremental ❌");
        }
      })();
    }

    prevSelectedRef.current = new Set(next);
  }, [selectedKeys, backendOk, inicio, fim]);

  // recarrega lista quando busca muda (não mexe na grid!)
  useEffect(() => {
    if (!backendOk) return;
    loadFuncionarios().catch(() =>
      setStatus("Falha ao carregar funcionários ❌")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendOk, qDebounced]);

  const calendar = useMemo(
    () => normalizeCalendar(rawCalendar, inicio, fim),
    [rawCalendar, inicio, fim]
  );

  // ✅ grid usa cache global, não o resultado do filtro
  const funcionariosByKey = useMemo(() => funcionariosCache, [funcionariosCache]);

  const visibleKeys = useMemo(() => {
    const gridSet = selectedKeys;

    // base = ordem global filtrada pelo que está na grid
    const base =
      rowOrderGlobal.length > 0
        ? rowOrderGlobal.filter((k) => gridSet.has(k))
        : Array.from(gridSet);

    if (!somenteSelecionados) return base;
    return base; // selecionados = grid
  }, [rowOrderGlobal, selectedKeys, somenteSelecionados]);

  const legendTags = useMemo(() => {
    return (Array.isArray(legenda) ? legenda : [])
      .slice(0, 18)
      .map((l, idx) => ({
        key: `${String(l.Codigo ?? "").trim()}-${idx}`,
        codigo: String(l.Codigo ?? "").trim(),
        nome: String(l.Nome ?? "").trim(),
      }))
      .filter((x) => x.codigo);
  }, [legenda]);

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
    // remover via grid = desmarcar
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      s.delete(k);
      return s;
    });
  }

  function selectAll() {
    // seleciona TUDO da lista atual (resultado do filtro)
    const keys = funcionarios
      .map((f) => String(f.Chave ?? "").trim())
      .filter(Boolean);
    setSelectedKeys((prev) => {
      const s = new Set(prev);
      for (const k of keys) s.add(k);
      return s;
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

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <div className="title">AgendaP83 — Escala</div>
          <div className="subtitle">{status}</div>
        </div>

        {/* topbar só período */}
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
              Arraste ⠿ para reordenar • Botão × remove da grid
            </div>
          </div>

          <div className="legend">
            <span>Legenda:</span>
            {legendTags.length === 0 ? (
              <span style={{ color: "#6b7280" }}>
                (carregue agenda para ver legenda)
              </span>
            ) : (
              legendTags.map((t) => (
                <span
                  key={t.key}
                  className={`tag code-${t.codigo}`}
                  title={t.nome || t.codigo}
                >
                  {t.codigo}
                </span>
              ))
            )}
          </div>

          <ScheduleGrid
            visibleKeys={visibleKeys}
            funcionariosByKey={funcionariosByKey}
            headerInfo={headerInfo}
            agendaMap={agendaMap}
            deletedCells={deletedCells}
            toggleCellDeleted={toggleCellDeleted}
            rowOrder={rowOrderGlobal}
            setRowOrder={setRowOrderGlobal}
            onRemoveRow={removeFromGrid}
          />
        </main>
      </div>
    </div>
  );
}
