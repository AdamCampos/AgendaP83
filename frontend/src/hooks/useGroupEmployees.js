import { useCallback, useState } from "react";

function dedupeBySubordinadoChave(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = String(r?.SubordinadoChave ?? "").trim();
    if (!k) continue;
    if (!m.has(k)) m.set(k, r);
  }
  return Array.from(m.values());
}

/**
 * Modo grupo (SUEIN/SUMEC/SUPROD/SUEMB)
 * - descobre supervisores por /api/funcionarios?funcao=... (se existir)
 * - fallback local se não existir
 * - busca /api/hierarquia?funcionarioChave=SUP
 * - dedupe e enriquece via funcionariosByKey
 *
 * Requisito: ao clicar, limpa lista imediatamente -> setGroupEmployees([])
 */
export function useGroupEmployees({ apiGet, funcionariosByKey, fallbackSupervisorsByGroup }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupEmployees, setGroupEmployees] = useState(null); // null = modo normal
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");

  const getSupervisorsForGroup = useCallback(
    async (grupo) => {
      // tenta endpoint (se existir)
      try {
        const list = await apiGet(
          `/api/funcionarios?funcao=${encodeURIComponent(grupo)}&ativo=1&limit=500`
        );
        const keys = (Array.isArray(list) ? list : [])
          .map((f) => String(f?.Chave ?? "").trim())
          .filter(Boolean);
        if (keys.length) return keys;
      } catch {
        // ignora
      }
      // fallback local
      return (fallbackSupervisorsByGroup?.[grupo] || []).map(String);
    },
    [apiGet, fallbackSupervisorsByGroup]
  );

  const loadSubordinatesForGroup = useCallback(
    async (grupo) => {
      const supervisors = await getSupervisorsForGroup(grupo);
      if (!supervisors.length) return { supervisors: [], list: [] };

      const all = await Promise.all(
        supervisors.map((k) =>
          apiGet(`/api/hierarquia?funcionarioChave=${encodeURIComponent(k)}`).catch(() => [])
        )
      );

      const unique = dedupeBySubordinadoChave(all.flat());

      const list = unique.map((r) => {
        const chave = String(r?.SubordinadoChave ?? "").trim();
        const f = funcionariosByKey?.get(chave);
        return {
          Chave: chave,
          Nome: f?.Nome ?? r?.NomeSubordinado ?? "(sem nome)",
          Matricula: f?.Matricula ?? "",
          Funcao: f?.Funcao ?? "",
        };
      });

      list.sort((a, b) => String(a.Nome).localeCompare(String(b.Nome), "pt-BR"));
      return { supervisors, list };
    },
    [apiGet, funcionariosByKey, getSupervisorsForGroup]
  );

  const pickGroup = useCallback(
    async (grupo) => {
      // null = voltar ao modo normal
      if (!grupo) {
        setActiveGroup(null);
        setGroupEmployees(null);
        setGroupError("");
        setGroupLoading(false);
        return;
      }

      setActiveGroup(grupo);

      // requisito (2): limpar lista imediatamente
      setGroupEmployees([]);
      setGroupError("");
      setGroupLoading(true);

      try {
        const { supervisors, list } = await loadSubordinatesForGroup(grupo);
        setGroupEmployees(list);

        if (!supervisors.length) {
          setGroupError(`Grupo ${grupo}: nenhum supervisor configurado/encontrado.`);
        } else if (!list.length) {
          setGroupError(`Grupo ${grupo}: supervisores ok (${supervisors.length}), mas hierarquia retornou 0 subordinados.`);
        }
      } catch (e) {
        setGroupEmployees([]);
        setGroupError(`Falha ao carregar grupo ${grupo}: ${e?.message ?? String(e)}`);
      } finally {
        setGroupLoading(false);
      }
    },
    [loadSubordinatesForGroup]
  );

  return { activeGroup, groupEmployees, groupLoading, groupError, pickGroup };
}
