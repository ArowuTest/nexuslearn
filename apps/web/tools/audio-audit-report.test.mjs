import test from "node:test";
import assert from "node:assert/strict";
import { renderAudioAuditReport } from "./audio-audit-report.mjs";

test("private listening report escapes scripts and cannot record approvals", () => {
  const html = renderAudioAuditReport({ total_files: 1, items: [{ text: "</script><script>alert(1)</script>", flags: [] }] });
  assert.ok(!html.includes("</script><script>alert"));
  assert.ok(html.includes("Slower comparison only"));
  assert.ok(html.includes("No approval is recorded"));
  assert.ok(!html.includes("fetch("));
});
