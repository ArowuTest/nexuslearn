// One attempt only. Callers own retry policy and must establish replay safety.
class AdminJSONError extends Error {
  constructor(message, kind, details = {}) {
    super(message);
    this.kind = kind;
    Object.assign(this, details);
  }
}

function apiRoot(value) {
  const invalid = () => new Error("invalid admin API URL: use HTTPS or explicit loopback HTTP without userinfo, query or fragment");
  if (typeof value !== "string" || !/^https?:\/\//i.test(value) || /[\\\s?#]/.test(value)) throw invalid();
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  const authority = value.match(/^https?:\/\/([^/]+)/i)?.[1] ?? "";
  if (!url.hostname || authority.includes("@") || url.username || url.password) throw invalid();
  if (url.protocol !== "https:" && !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value)) throw invalid();
  // Append routes to the existing base path, as both operators historically did.
  return url.href.replace(/\/$/, "");
}

export function createAdminJSONTransport({ baseURL, fetchImpl = fetch, timeoutMs = 30_000, maxResponseBytes = 8 * 1024 * 1024 }) {
  const root = apiRoot(baseURL);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 ||
      !Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 8 * 1024 * 1024) {
    throw new Error("invalid admin API transport limits");
  }
  return async (route, { method, headers, body }) => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    try {
      const response = await fetchImpl(`${root}${route}`, { method, headers, body, redirect: "manual", signal });
      if (response.status >= 300 && response.status < 400) {
        throw new AdminJSONError("admin API redirect refused", "redirect");
      }
      if (!response.ok) {
        const seconds = Number(response.headers.get("retry-after"));
        throw new AdminJSONError(`admin API request failed with status ${response.status}`, "http", {
          status: response.status,
          retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? Math.min(8000, seconds * 1000) : 0,
        });
      }
      const reader = response.body?.getReader();
      const chunks = [];
      let bytes = 0;
      try {
        if (reader) for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxResponseBytes) throw new AdminJSONError("admin API response exceeds size limit", "size");
          chunks.push(value);
        }
      } finally { reader?.releaseLock(); }
      try { return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8")); }
      catch { throw new AdminJSONError("admin API returned invalid JSON", "json"); }
    } catch (error) {
      // Never retain raw fetch/JSON errors, bodies, Location headers or their causes.
      if (error instanceof AdminJSONError) throw error;
      throw new AdminJSONError(signal.aborted ? "admin API request timed out" : "admin API network request failed", signal.aborted ? "timeout" : "network");
    } finally {
      // Also cancel unread error/redirect bodies; the deadline covers body streaming.
      controller.abort();
    }
  };
}
