function isAbsUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function getBaseUrl() {
  const baseRaw = import.meta.env.BASE_URL || "/";
  return baseRaw.endsWith("/") ? baseRaw : baseRaw + "/";
}

function apiDbgEnabled() {
  try {
    return localStorage.getItem("AGENDA_API_DEBUG") === "1";
  } catch {
    return false;
  }
}

function apiDbg(tag, obj) {
  if (!apiDbgEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(`[api] ${tag}`, obj);
}

function safePreview(txt, max = 260) {
  const s = String(txt ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Resolve URL APENAS para chamadas de API.
 *
 * Regras:
 * - Se for http/https => retorna como está
 * - Se vier com BASE_URL colado (ex: /AgendaP83/api/...) => remove BASE_URL e vira /api/...
 * - Se começar com /api => NÃO aplica BASE_URL nunca
 * - Em DEV, se VITE_API_ORIGIN estiver definido, prefixa (ex: http://localhost:8311)
 *   Caso contrário, tenta automaticamente: http(s)://<hostname>:8311
 */
function resolveApiUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return u;
  if (isAbsUrl(u)) return u;

  const base = getBaseUrl(); // "/AgendaP83/" no build
  const abs = u.startsWith("/") ? u : `/${u}`;

  // 1) se veio errado com BASE + "api/...", corrige:
  //    "/AgendaP83/api/xxx" => "/api/xxx"
  if (abs.startsWith(base)) {
    // Mantém a "/" inicial do resto
    const rest = abs.slice(base.length - 1); // "/api/..."
    if (rest.startsWith("/api/")) {
      return finalizeWithDevOrigin(rest);
    }
    // se não for api, devolve como está (caso raro)
    return finalizeWithDevOrigin(abs);
  }

  // 2) caminho normal de API
  if (abs.startsWith("/api/")) {
    return finalizeWithDevOrigin(abs);
  }

  // 3) fallback: se alguém passar "api/..." sem barra
  if (abs === "/api" || abs.startsWith("/api?")) {
    return finalizeWithDevOrigin(abs);
  }

  // 4) Se não começa com /api, ainda assim não vamos colar BASE_URL aqui.
  return finalizeWithDevOrigin(abs);
}

function defaultDevOrigin8311() {
  try {
    const proto = window.location.protocol || "http:";
    const host = window.location.hostname || "localhost";
    return `${proto}//${host}:8311`;
  } catch {
    return "http://localhost:8311";
  }
}

function finalizeWithDevOrigin(pathAbs) {
  const p = String(pathAbs || "");
  const originEnv = String(import.meta.env.VITE_API_ORIGIN || "").trim();

  // DEV:
  // - se VITE_API_ORIGIN definido: usa ele
  // - senão: tenta automaticamente hostname:8311
  if (import.meta.env.DEV) {
    const origin = originEnv || defaultDevOrigin8311();
    return origin.replace(/\/+$/, "") + p;
  }

  // BUILD: mesma origem
  return p;
}

async function readBodyText(r) {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

function looksLikeHtml(s) {
  const t = String(s || "").trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head") || t.includes("<body");
}

function parseJsonFromText(text) {
  // não tenta ser esperto: parse direto pra pegar erro real (e preview no debug)
  return JSON.parse(text);
}

async function requestJson(method, url, body) {
  const finalUrl = resolveApiUrl(url);

  apiDbg(method, { url, finalUrl, ...(method !== "GET" ? { body } : {}) });

  const r = await fetch(finalUrl, {
    method,
    headers: body != null ? { "Content-Type": "application/json" } : undefined,
    credentials: "same-origin",
    body: body != null ? JSON.stringify(body ?? {}) : undefined,
  });

  const ct = r.headers.get("content-type") || "";
  const bodyText = await readBodyText(r);
  const bodyPreview = safePreview(bodyText);

  if (!r.ok) {
    apiDbg(`${method}_FAIL`, { finalUrl, status: r.status, contentType: ct, bodyPreview });
    throw new Error(`HTTP ${r.status} em ${finalUrl}`);
  }

  // OK
  // Debug SEMPRE mostra preview quando não conseguir parsear (inclusive HTML do SPA).
  try {
    if (!bodyText) {
      apiDbg(`${method}_OK_NO_BODY`, { finalUrl, status: r.status, contentType: ct });
      return null;
    }

    const data = parseJsonFromText(bodyText);
    apiDbg(`${method}_OK`, { finalUrl, status: r.status, contentType: ct, bodyPreview });
    return data;
  } catch (e) {
    apiDbg(`${method}_JSON_FAIL`, {
      finalUrl,
      status: r.status,
      contentType: ct,
      bodyPreview,
      err: e?.message ?? String(e),
    });

    if (looksLikeHtml(bodyText)) {
      throw new Error(
        `Resposta HTML (SPA) em vez de JSON em ${finalUrl}. ` +
          `Provável rota errada / BASE_URL colado / proxy dev apontando para o lugar errado.`
      );
    }

    throw new Error(`Falha ao ler JSON em ${finalUrl}: ${e?.message ?? String(e)}`);
  }
}

export async function apiGet(url) {
  return requestJson("GET", url, null);
}

export async function apiPost(url, body) {
  return requestJson("POST", url, body ?? {});
}

export async function apiDelete(url, body) {
  return requestJson("DELETE", url, body ?? {});
}
