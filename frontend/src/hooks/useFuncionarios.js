import { useCallback, useEffect, useMemo, useState } from "react";

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
      const keys = list.map((f) => String(f?.Chave ?? "").trim()).filter(Boolean);
      if (!prev.length) return keys;
      const prevSet = new Set(prev);
      return [...prev, ...keys.filter((k) => !prevSet.has(k))];
    });

    return list;
  }, [apiGet, qDebounced]);

  useEffect(() => {
    if (!backendOk) return;
    loadFuncionarios().catch(() => {});
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
