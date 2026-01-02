// Helpers de Set/Map

export function setDiff(a, b) {
    const out = new Set();
    for (const x of a) if (!b.has(x)) out.add(x);
    return out;
  }
  
  export function mapMerge(oldMap, newMap) {
    const m = new Map(oldMap);
    for (const [k, v] of newMap.entries()) m.set(k, v);
    return m;
  }
  
  export function purgeMapByKeysPrefix(map, keys) {
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
  
  export function purgeSetByKeysPrefix(set, keys) {
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
  