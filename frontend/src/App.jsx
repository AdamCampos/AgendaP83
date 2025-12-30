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
  const m = typeof s === "string" ? s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function pickDateFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  return obj.Data || obj.data || obj.Dia || obj.dia || obj.Date || obj.date || obj.Value || obj.value || null;
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

export default function App() {
  const [status, setStatus] = useState("verificando...");
  const [backendOk, setBackendOk] = useState(false);

  const today = useRef(isoToday());
  const [inicio, setInicio] = useState(isoAddDays(today.current, -7));
  const [fim, setFim] = useState(isoAddDays(today.current, 21));

  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q, 250);

  const [ativos, setAtivos] = useState(true);
  const [somenteSelecionados, setSomenteSelecionados] = useState(true);

  const [funcionarios, setFuncionarios] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  const [rawCalendar, setRawCalendar] = useState([]);
  const [legenda, setLegenda] = useState([]);
  const [agendaMap, setAgendaMap] = useState(new Map());

  const [deletedCells, setDeletedCells] = useState(new Set());
  const [rowOrder, setRowOrder] = useState([]);

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
    params.set("ativos", ativos ? "1" : "0");

    const data = await apiGet(`/api/funcionarios?${params.toString()}`);
    const list = Array.isArray(data) ? data : [];
    setFuncionarios(list);

    // mantém seleção existente; se não tem seleção ainda, inicia com os primeiros
    if (selectedKeys.size === 0) {
      const first = list.slice(0, 30).map((f) => String(f.Chave ?? "").trim());
      setSelectedKeys(new Set(first.filter(Boolean)));
    }

    setRowOrder((prev) => {
      const keys = list.map((f) => String(f.Chave ?? "").trim()).filter(Boolean);
      if (prev.length === 0) return keys;
      const prevSet = new Set(prev);
      return [
        ...prev.filter((k) => keys.includes(k)),
        ...keys.filter((k) => !prevSet.has(k)),
      ];
    });
  }

  async function loadAgenda() {
    const chaves = Array.from(selectedKeys).filter(Boolean);
    if (chaves.length === 0) {
      setAgendaMap(new Map());
      setRawCalendar([]);
      setStatus("Selecione funcionários para carregar a agenda.");
      return;
    }

    const params = new URLSearchParams();
    params.set("inicio", inicio);
    params.set("fim", fim);
    params.set("chaves", chaves.join(","));

    const combo = await apiGet(`/api/agenda?${params.toString()}`);

    setRawCalendar(Array.isArray(combo?.calendario) ? combo.calendario : []);
    setLegenda(Array.isArray(combo?.legenda) ? combo.legenda : []);

    const rows = Array.isArray(combo?.agendaDia) ? combo.agendaDia : [];
    const m = new Map();

    for (const r of rows) {
      const fk = String(r.FuncionarioChave ?? "").trim();

      let dtRaw = r.Data;
      let dt = typeof dtRaw === "string" ? dtRaw : pickDateFromObject(dtRaw) ?? "";
      if (dt.includes("T")) dt = dt.slice(0, 10);
      if (!isIsoLike(dt)) {
        const br = brToIso(dt);
        if (br) dt = br;
      }

      if (!fk || !dt) continue;
      m.set(`${fk}|${dt}`, r);
    }

    setAgendaMap(m);
    setStatus(`Agenda carregada ✅ (${rows.length} eventos)`);
  }

  // ✅ AQUI ESTÁ O FIX DO FILTRO:
  // sempre que qDebounced ou ativos mudar, recarrega a lista.
  useEffect(() => {
    if (!backendOk) return;
    loadFuncionarios().catch(() => setStatus("Falha ao carregar funcionários ❌"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendOk, qDebounced, ativos]);

  const calendar = useMemo(
    () => normalizeCalendar(rawCalendar, inicio, fim),
    [rawCalendar, inicio, fim]
  );

  const funcionariosByKey = useMemo(() => {
    const map = new Map();
    for (const f of funcionarios) {
      const k = String(f.Chave ?? "").trim();
      if (k) map.set(k, f);
    }
    return map;
  }, [funcionarios]);

  const visibleKeys = useMemo(() => {
    const all =
      rowOrder.length > 0
        ? rowOrder
        : funcionarios.map((f) => String(f.Chave ?? "").trim()).filter(Boolean);

    if (!somenteSelecionados) return all;
    return all.filter((k) => selectedKeys.has(k));
  }, [funcionarios, rowOrder, selectedKeys, somenteSelecionados]);

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
  
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(".", "");
  
      // ✅ NOVO: marca início de mês (para borda vertical)
      const isMonthStart = d.getDate() === 1;
  
      return {
        iso,
        day,
        isWeekend,
        monthKey,
        monthLabel,
        isMonthStart,
      };
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
      } else {
        last.count++;
      }
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

  function selectAll() {
    const keys = funcionarios.map((f) => String(f.Chave ?? "").trim()).filter(Boolean);
    setSelectedKeys(new Set(keys));
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

        <div className="controls">

          <div className="control">
            <label>Início</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>

          <div className="control">
            <label>Fim</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>

          <button className="btn btn-secondary" onClick={() => loadFuncionarios()}>
            Atualizar funcionários
          </button>

          <button className="btn" onClick={() => loadAgenda()}>
            Carregar agenda
          </button>
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
          ativos={ativos}
          setAtivos={setAtivos}
          selectAll={selectAll}
          clearSelection={clearSelection}
        />


        <main className="content">
          <div className="content-header">
            <div className="h">
              Escala ({calendar.length} dias) — Linhas: {visibleKeys.length}
            </div>
            <div className="status">
              Dica: <b>Alt+Clique</b> numa célula = excluir/reincluir (local). • Arraste ⠿ para reordenar
            </div>
          </div>

          <div className="legend">
            <span>Legenda:</span>
            {legendTags.length === 0 ? (
              <span style={{ color: "#6b7280" }}>(carregue agenda para ver legenda)</span>
            ) : (
              legendTags.map((t) => (
                <span key={t.key} className={`tag code-${t.codigo}`} title={t.nome || t.codigo}>
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
            rowOrder={rowOrder}
            setRowOrder={setRowOrder}
          />
        </main>
      </div>
    </div>
  );
}
