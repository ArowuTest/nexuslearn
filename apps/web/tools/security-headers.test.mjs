import assert from "node:assert/strict";
import test from "node:test";
import { securityHeaders } from "../src/lib/security-headers.mjs";

function header(headers, key) {
  return headers.find((item) => item.key === key)?.value ?? "";
}

test("local pages set browser protections without forcing https", () => {
  const headers = securityHeaders({});
  assert.equal(header(headers, "X-Content-Type-Options"), "nosniff");
  assert.equal(header(headers, "X-Frame-Options"), "DENY");
  assert.equal(header(headers, "Strict-Transport-Security"), "");
  const policy = header(headers, "Content-Security-Policy");
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.match(policy, /connect-src ws: wss:/);
  assert.match(policy, /https:\/\/nexuslearn-api\.onrender\.com/);
  assert.doesNotMatch(policy, /http:\/\/evil\.example/);
});

test("production adds https pinning and the configured api origin", () => {
  const headers = securityHeaders({ NEXUSLEARN_ENV: "production", NEXT_PUBLIC_API_URL: "https://family-api.example/v1" });
  assert.match(header(headers, "Strict-Transport-Security"), /max-age=63072000/);
  const policy = header(headers, "Content-Security-Policy");
  assert.match(policy, /https:\/\/family-api\.example/);
  assert.doesNotMatch(policy, /unsafe-eval/);
});
