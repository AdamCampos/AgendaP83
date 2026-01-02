// Utilitários de datas (ISO yyyy-mm-dd)

export function toIsoDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  
  export function isoToday() {
    return toIsoDate(new Date());
  }
  
  export function isoAddDays(iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return toIsoDate(d);
  }
  
  export function isoRange(inicio, fim) {
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
  
  export function isIsoLike(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
  }
  
  export function brToIso(s) {
    const m = typeof s === "string" ? s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  
  export function pickDateFromObject(obj) {
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
  
  export function normalizeCalendar(rawCalendar, inicio, fim) {
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
  