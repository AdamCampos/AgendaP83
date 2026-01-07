import { useCallback, useEffect, useMemo, useState } from "react";

function debugEnabled() {
  try {
    return localStorage.getItem("AGENDA_FUNC_DEBUG") === "1";
  } catch {
    return false;
  }
}

function dbg(...args) {
  if (!debugEnabled()) return;
  console.debug("[useFuncionarios]", ...args);
}

/**
 * Carrega funcionários e mantém:
 * - lista
 * - cache por chave (Map)
 * - rowOrder estável
 */
export function useFuncionarios({ apiGet, backendOk, qDebounced }) {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcCache, setFuncCache] = useState(() => new Map());
  const [rowOrder, setRowOrder] = useState([]);

  const loadFuncionarios = useCallback(async () => {
    const params = new URLSearchParams();
    const q = String(qDebounced ?? "").trim();
    if (q) params.set("q", q);

    // ✅ sempre ativos (ajuste se quiser ver inativos)
    params.set("ativo", "1");
    // ✅ tenta pegar bastante (se o backend limitar, ele limita)
    params.set("limit", "1000");

    const url = `/api/funcionarios?${params.toString()}`;
    dbg("loadFuncionarios()", { backendOk, q, url });

    const data = await apiGet(url);
    const list = Array.isArray(data) ? data : [];

    dbg("loadFuncionarios() result", { count: list.length });

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
      const keys = list.map((f) => String(f?.Chave ?? "").trim()).filter(Boolean);
      if (!prev.length) return keys;
      const prevSet = new Set(prev);
      return [...prev, ...keys.filter((k) => !prevSet.has(k))];
    });

    return list;
  }, [apiGet, qDebounced, backendOk]);

  useEffect(() => {
    if (!backendOk) {
      dbg("backendOk=false => skip load");
      return;
    }
    loadFuncionarios().catch((e) => {
      dbg("loadFuncionarios() FAIL", { message: e?.message ?? String(e) });
    });
  }, [backendOk, loadFuncionarios]);

  const funcionariosByKey = useMemo(() => {
    const map = new Map(funcCache);
    for (const f of funcionarios) {
      const k = String(f?.Chave ?? "").trim();
      if (k) map.set(k, f);
    }
    return map;
  }, [funcCache, funcionarios]);

  return {
    funcionarios,
    funcCache,
    rowOrder,
    setRowOrder,
    loadFuncionarios,
    funcionariosByKey,
  };
}

// ✅ compat: se algum lugar importar default sem chaves
export default useFuncionarios;
