import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { createAdminJSONTransport } from "./admin-json-transport.mjs";

test("transport strips network diagnostics and causes and never adds retries", async () => {
  const secret = "fake-secret";
  let attempts = 0;
  const request = createAdminJSONTransport({ baseURL: "https://example.invalid/prefix", fetchImpl: async () => {
    attempts++;
    throw new Error(`socket ${secret}`, { cause: new Error(secret) });
  } });
  await assert.rejects(() => request("/v1/admin/ai-reviews", { method: "POST", body: "{}" }), error => {
    assert.equal(error.kind, "network");
    assert.equal(error.cause, undefined);
    assert.equal(error.stack.includes(secret), false);
    return true;
  });
  assert.equal(attempts, 1);
});

test("transport bounds decoded bytes rather than compressed size or character count", async t => {
  const payload = JSON.stringify({ text: "é".repeat(80) });
  const compressed = gzipSync(payload);
  assert.ok(payload.length < 128 && Buffer.byteLength(payload) > 128 && compressed.length < 128);
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json", "Content-Encoding": "gzip", "Content-Length": compressed.length });
    res.end(compressed);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const request = createAdminJSONTransport({ baseURL: `http://127.0.0.1:${server.address().port}`, maxResponseBytes: 128 });
  await assert.rejects(() => request("/test", { method: "POST" }), error => error.kind === "size");
});

test("transport cancels stalled error bodies without parsing or waiting for them", async t => {
  let closed;
  const bodyClosed = new Promise(resolve => { closed = resolve; });
  const server = createServer((req, res) => {
    req.resume();
    res.on("close", closed);
    res.writeHead(401, { "Content-Type": "application/json" });
    res.write('{"secret":"fake-secret');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const request = createAdminJSONTransport({ baseURL: `http://127.0.0.1:${server.address().port}`, timeoutMs: 500 });
  await assert.rejects(() => request("/test", { method: "POST" }), error => {
    assert.equal(error.status, 401);
    assert.equal(error.stack.includes("fake-secret"), false);
    return true;
  });
  let watchdog;
  try {
    await Promise.race([bodyClosed, new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error("error body not cancelled")), 1500); })]);
  } finally { clearTimeout(watchdog); }
});

test("injected transport limits cannot disable deadlines or memory bounds", () => {
  for (const options of [
    { timeoutMs: 0 }, { timeoutMs: NaN }, { timeoutMs: Infinity }, { timeoutMs: 30_001 },
    { maxResponseBytes: 0 }, { maxResponseBytes: NaN }, { maxResponseBytes: Infinity }, { maxResponseBytes: 8 * 1024 * 1024 + 1 },
  ]) {
    assert.throws(() => createAdminJSONTransport({ baseURL: "https://example.invalid", ...options }), /invalid admin API transport limits/);
  }
});
