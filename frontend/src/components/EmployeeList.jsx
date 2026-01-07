import { memo, useEffect, useMemo, useState } from "react";

import { Tree } from "primereact/tree";
import { ProgressSpinner } from "primereact/progressspinner";
import { Message } from "primereact/message";

function normalizeText(v) {
  return String(v ?? "").toLowerCase();
}

function matchesQuery(f, q) {
  if (!q) return true;
  const term = normalizeText(String(q).trim());
  if (!term) return true;

  return (
    normalizeText(f?.Nome).includes(term) ||
    normalizeText(f?.Chave).includes(term) ||
    normalizeText(f?.Matricula).includes(term) ||
    normalizeText(f?.Funcao).includes(term)
  );
}

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

function buildNestedGroupNodes(flat) {
  const items = Array.isArray(flat) ? flat : [];
  const roots = [];
  const stack = [];

  for (const it of items) {
    const id = String(it?.id ?? "").trim();
    const level = Math.max(0, Number(it?.level ?? 0));
    if (!id) continue;

    const node = {
      key: id,
      label: id,
      data: { id, level, tone: String(it?.tone ?? "neutral") },
      children: [],
    };

    if (level === 0) {
      roots.push(node);
      stack.length = 0;
      stack[0] = node;
      continue;
    }

    const parent = stack[level - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);

    stack[level] = node;
    stack.length = Math.max(stack.length, level + 1);
  }

  const prune = (n) => {
    if (!Array.isArray(n.children) || n.children.length === 0) delete n.children;
    else n.children.forEach(prune);
  };
  roots.forEach(prune);

  return roots;
}

function buildInitialExpandedKeys(nodes, maxLevelToAutoExpand = 1) {
  const out = {};
  const walk = (list) => {
    for (const n of list || []) {
      const lvl = Number(n?.data?.level ?? 0);
      const hasChildren = Array.isArray(n?.children) && n.children.length > 0;
      if (hasChildren && lvl <= maxLevelToAutoExpand) out[n.key] = true;
      if (hasChildren) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export default memo(function EmployeeList({
  q,
  setQ,
  funcionarios,
  selectedKeys,
  toggleSelectKey,
  somenteSelecionados,
  setSomenteSelecionados,
  selectAll,
  clearSelection,
  onRefreshEmployees,
  onRepor,

  // ✅ compat: alguns lugares chamavam de "groups", mas o App novo passa "groupTree"
  groups = [],
  groupTree,

  activeGroup = null,
  onPickGroup,
  groupLoading = false,
  groupError = "",
}) {
  const list = Array.isArray(funcionarios) ? funcionarios : [];

  const filtered = useMemo(() => {
    const qTrim = String(q ?? "").trim();

    let base = list;

    // 1) busca
    if (qTrim) base = base.filter((f) => matchesQuery(f, qTrim));

    // 2) "somente selecionados" só no modo normal (activeGroup === null)
    if (somenteSelecionados && activeGroup === null) {
      base = base.filter((f) => {
        const k = String(f?.Chave ?? "").trim();
        return k && selectedKeys.has(k);
      });
    }

    return base;
  }, [list, q, somenteSelecionados, selectedKeys, activeGroup]);

  // ===== Grupos (PrimeReact Tree) =====
  const flatGroups = useMemo(() => {
    const src = Array.isArray(groupTree) && groupTree.length ? groupTree : groups;
    return Array.isArray(src) ? src : [];
  }, [groupTree, groups]);

  const groupNodes = useMemo(() => {
    const nested = buildNestedGroupNodes(flatGroups);
    return [
      {
        key: "__ALL__",
        label: "TODOS",
        data: { id: "__ALL__", level: 0, tone: "neutral", isAll: true },
      },
      ...nested,
    ];
  }, [flatGroups]);

  const [expandedKeys, setExpandedKeys] = useState({});

  useEffect(() => {
    setExpandedKeys(buildInitialExpandedKeys(groupNodes, 1)); // auto-expande até nível 1
  }, [groupNodes]);

  const selectedGroupKey = activeGroup ? String(activeGroup) : "__ALL__";

  const nodeTemplate = (node) => {
    const lvl = Number(node?.data?.level ?? 0);
    const led = toneToHex(node?.data?.tone);

    return (
      <div className="group-node" data-level={lvl}>
        <span className="group-led" style={{ background: led }} />
        <span className="group-text">{String(node?.label ?? "")}</span>
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="h">Funcionários</div>
        <div className="small">
          Selecionados: <b>{selectedKeys.size}</b>
        </div>
      </div>

      {/* ===== Grupos (Tree) ===== */}
      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <div className="sidebar-section-title">Grupos</div>
          {groupLoading ? (
            <ProgressSpinner style={{ width: 16, height: 16 }} strokeWidth="4" />
          ) : null}
        </div>

        {groupError ? (
          <div style={{ marginBottom: 8 }}>
            <Message severity="warn" text={String(groupError)} />
          </div>
        ) : null}

        <div className={groupLoading ? "tree-wrap is-loading" : "tree-wrap"}>
          <Tree
            value={groupNodes}
            nodeTemplate={nodeTemplate}
            expandedKeys={expandedKeys}
            onToggle={(e) => setExpandedKeys(e.value)}
            selectionMode="single"
            selectionKeys={selectedGroupKey}
            onSelectionChange={(e) => {
              const key = String(e.value ?? "");
              onPickGroup?.(key === "__ALL__" ? null : key);
            }}
          />
        </div>
      </div>

      {/* ===== Busca (mantida) ===== */}
      <div className="sidebar-search">
        <label>Buscar (nome / chave / matrícula / função)</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ex: JOÃO, 0A1B, 12345, TMA"
        />
      </div>

      {/* ===== Botões (mantidos) ===== */}
      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={onRefreshEmployees} type="button">
          Atualizar funcionários
        </button>
        <button className="btn btn-secondary" onClick={onRepor} type="button">
          Repor (limpa grid)
        </button>
      </div>

      <div className="sidebar-actions">
        <button
          className="btn btn-secondary"
          onClick={selectAll}
          type="button"
          disabled={!list.length}
        >
          Selecionar todos
        </button>
        <button
          className="btn btn-secondary"
          onClick={clearSelection}
          type="button"
          disabled={selectedKeys.size === 0}
        >
          Limpar seleção
        </button>
      </div>

      <div className="sidebar-actions">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={somenteSelecionados}
            onChange={(e) => setSomenteSelecionados(e.target.checked)}
          />
          Mostrar apenas selecionados
        </label>
      </div>

      {/* ===== Lista ===== */}
      <div className="func-list">
        {filtered.map((f) => {
          const k = String(f?.Chave ?? "").trim();
          const nome = String(f?.Nome ?? "").trim();
          const mat = String(f?.Matricula ?? "").trim();
          const func = String(f?.Funcao ?? "").trim();
          const checked = k ? selectedKeys.has(k) : false;

          return (
            <div className="func-item" key={k || `${nome}-${mat}-${func}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!k}
                onChange={() => k && toggleSelectKey(k)}
              />

              <div className="func-meta">
                <div className="func-name">
                  {nome || "(sem nome)"} {k ? <span className="func-chip">{k}</span> : null}
                </div>
                <div className="func-sub">
                  {mat ? `Matrícula: ${mat}` : "—"} {func ? `• ${func}` : ""}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div className="small" style={{ padding: 8, opacity: 0.75 }}>
            Nenhum funcionário para exibir.
          </div>
        ) : null}
      </div>
    </aside>
  );
});
