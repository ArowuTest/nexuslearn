"use client";
import { useState } from "react";

type Check = { code: string; passed: boolean; message: string };
type Report = { release_id: string; manifest_sha256: string; evidence_ready: boolean; checks: Check[] };
type Request = (path: string, options?: RequestInit) => Promise<unknown>;
const REQUIRED = ["ai_review", "safeguarding", "audio_release", "audio_listening", "child_pilot"];

export default function AdminReleasePreflight({ request }: { request: Request }) {
  const [text, setText] = useState(""); const [report, setReport] = useState<Report>(); const [busy, setBusy] = useState(false);
  async function run() {
    let manifest: Record<string, unknown>;
    try { const value: unknown = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); manifest = value as Record<string, unknown>; if (manifest.channel !== "live" || typeof manifest.id !== "string" || typeof manifest.manifest_sha256 !== "string") throw new Error(); }
    catch { setReport(undefined); return; }
    setBusy(true); try { const result = await request("/v1/admin/content/releases/preflight", { method: "POST", body: JSON.stringify(manifest) }) as Report; if (result.release_id !== manifest.id || result.manifest_sha256 !== manifest.manifest_sha256) throw new Error(); if (!Array.isArray(result.checks) || result.checks.length !== REQUIRED.length || REQUIRED.some((code) => !result.checks.some((check) => check.code === code))) throw new Error(); setReport(result); }
    catch { setReport(undefined); } finally { setBusy(false); }
  }
  return <section><h2>Live release preflight</h2><textarea aria-label="Live release manifest JSON" value={text} onChange={(event) => setText(event.target.value)} /><button type="button" onClick={() => void run()} disabled={busy || !text.trim()}>{busy ? "Checking…" : "Run read-only preflight"}</button>{report && <div><p>{report.evidence_ready ? "Evidence ready" : "Evidence blocked"}</p><ul aria-label="Release evidence checks">{report.checks.map((check) => <li key={check.code}>{check.passed ? "✓" : "!"} <strong>{check.code.replaceAll("_", " ")}</strong> {check.message}</li>)}</ul></div>}</section>;
}
