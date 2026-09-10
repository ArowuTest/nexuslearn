"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { accountSessionHeaders, subscribeAccountSession } from "@/lib/api";
import { Actions, Field, LabeledSelect, LearnerScopeNotice, Panel, TextArea } from "./SchoolWorkspacePrimitives";
import SchoolObjectivePicker, { type SchoolObjective } from "./SchoolObjectivePicker";

type Kind = "assignment" | "evidence" | "intervention";
type Learner = { external_ref: string; display_name: string; year_group: number };
const settings = {
  assignment: { title: "Assign Learning Priority", purpose: "assignment", action: "Assign learning", path: "assignments", saved: "Learning priority saved." },
  evidence: { title: "Record Teacher Evidence", purpose: "teacher evidence", action: "Save teacher evidence", path: "evidence", saved: "Teacher evidence saved." },
  intervention: { title: "Create Intervention Plan", purpose: "intervention", action: "Create intervention", path: "interventions", saved: "Intervention plan saved." },
};
const emptyDraft = (kind: Kind) => ({ title: "", activity: "", priority: kind === "assignment" ? 70 : 85, date: "", evidenceType: "observation", outcome: "developing", note: "", source: "", need: "", strategy: "" });
const authorization = () => accountSessionHeaders(["school_admin", "teacher"]).Authorization ?? "";

// Mounted with a learner key by the workspace: notes and logical requests cannot
// silently move to another pupil. Each confirmed POST resets only this form.
export default function SchoolLearningTask({ kind, learner, disabled, request, onSaved, onBusyChange }: {
  kind: Kind; learner?: Learner; disabled: boolean;
  request: (path: string, options: RequestInit) => Promise<unknown>; onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  const config = settings[kind];
  const [draft, setDraft] = useState(() => emptyDraft(kind));
  const [objective, setObjective] = useState<SchoolObjective | null>(null);
  const chooseObjective = useCallback((value: SchoolObjective | null) => {
    setObjective(value);
    setDraft(current => ({ ...current, activity: "" }));
  }, []);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const [owner] = useState(authorization);
  const version = useRef(0);
  const inFlight = useRef(false);
  const invalidated = useRef(false);
  const requestKey = useRef({ fingerprint: "", value: "" });
  useEffect(() => () => { version.current += 1; if (inFlight.current) onBusyChange(false); }, [onBusyChange]);
  useEffect(() => subscribeAccountSession(() => {
    if (invalidated.current || owner === authorization()) return;
    invalidated.current = true;
    version.current += 1;
    setDraft(emptyDraft(kind)); setObjective(null); setMessage(""); setRefreshFailed(false); setExpired(true);
    requestKey.current = { fingerprint: "", value: "" };
    if (inFlight.current) { inFlight.current = false; onBusyChange(false); }
  }), [owner, kind, onBusyChange]);
  const edit = (key: keyof typeof draft, value: string | number) => setDraft(current => ({ ...current, [key]: value }));
  const valid = !!learner && !!objective && (kind === "evidence" ? !!draft.note.trim() : !!draft.title.trim() && Number.isInteger(draft.priority) && draft.priority >= 1 && draft.priority <= 100)
    && (kind !== "intervention" || !!draft.need.trim() && !!draft.strategy.trim())
    && (!draft.date || Number.isFinite(Date.parse(draft.date)));

  async function save() {
    if (!valid || disabled || inFlight.current || expired || !learner || !objective) return;
    if (!owner || owner !== authorization()) { setDraft(emptyDraft(kind)); setObjective(null); setExpired(true); return; }
    const currentVersion = version.current;
    const current = () => currentVersion === version.current && owner === authorization();
    const common = { student_external_ref: learner.external_ref, objective_id: objective.id };
    const payload = kind === "evidence" ? { ...common, evidence_type: draft.evidenceType, outcome: draft.outcome, note: draft.note.trim(), source_ref: draft.source.trim() }
      : { ...common, title: draft.title.trim(), priority: draft.priority, status: "active", ...(kind === "assignment" ? { activity_id: draft.activity.trim(), due_at: draft.date ? new Date(draft.date).toISOString() : "" } : { need: draft.need.trim(), strategy: draft.strategy.trim(), review_due_at: draft.date ? new Date(draft.date).toISOString() : "" }) };
    const body = JSON.stringify(payload);
    const fingerprint = `${owner}:${body}`;
    if (requestKey.current.fingerprint !== fingerprint || !requestKey.current.value) requestKey.current = { fingerprint, value: crypto.randomUUID() };
    inFlight.current = true; onBusyChange(true); setFailed(false); setRefreshFailed(false); setMessage("Saving…");
    let confirmed = false;
    try {
      await request(`/v1/school/${config.path}`, { method: "POST", headers: { "Idempotency-Key": requestKey.current.value }, body });
      if (!current()) return;
      confirmed = true;
      requestKey.current = { fingerprint: "", value: "" };
      setDraft(emptyDraft(kind)); setObjective(null); setMessage(config.saved);
      await onSaved();
    } catch {
      if (current()) { setFailed(true); setRefreshFailed(confirmed); setMessage(confirmed ? `${config.saved} The workspace list could not be refreshed. Use Refresh saved records to check it.` : "We could not confirm the save. Your draft is kept. Retrying the same draft reuses its request key to avoid duplicates."); }
    } finally {
      if (current()) { inFlight.current = false; onBusyChange(false); }
    }
  }

  async function refreshSaved() {
    if (disabled || inFlight.current || expired || !owner || owner !== authorization()) return;
    const requestVersion = version.current;
    const current = () => requestVersion === version.current && owner === authorization();
    inFlight.current = true; onBusyChange(true);
    try {
      await onSaved();
      if (current()) { setRefreshFailed(false); setFailed(false); setMessage(config.saved); }
    } catch {
      if (current()) { setFailed(true); setMessage(`${config.saved} The workspace list could not be refreshed. Please try again.`); }
    } finally {
      if (current()) { inFlight.current = false; onBusyChange(false); }
    }
  }

  return <Panel title={config.title}>
    <LearnerScopeNotice purpose={config.purpose} learner={learner} />
    <fieldset disabled={disabled || !learner || expired}>
      <SchoolObjectivePicker year={learner?.year_group ?? 1} value={objective} onChange={chooseObjective} disabled={disabled || !learner || expired} />
      {kind === "assignment" && <details className="px-5"><summary className="min-h-11 cursor-pointer py-3 font-semibold text-[#42506b]">Advanced activity override</summary><p className="text-sm leading-6 text-[#42506b]">Leave this blank to let the adaptive engine choose an eligible activity for the selected objective. A supplied ID must belong to that objective.</p><Field label="Activity ID (optional)" value={draft.activity} onChange={value => edit("activity", value)} /></details>}
      {kind !== "evidence" && <Field label={kind === "assignment" ? "Teacher note/title" : "Plan title"} value={draft.title} onChange={value => edit("title", value)} />}
      {kind === "intervention" && <><TextArea label="Identified learning need" value={draft.need} onChange={value => edit("need", value)} /><TextArea label="Teaching strategy" value={draft.strategy} onChange={value => edit("strategy", value)} /></>}
      {kind === "evidence" ? <>
        <LabeledSelect label="Evidence type" value={draft.evidenceType} values={["observation", "work_sample", "conversation", "assessment", "external"]} onChange={value => edit("evidenceType", value)} />
        <LabeledSelect label="Outcome" value={draft.outcome} values={["secure", "developing", "needs_support", "inconclusive"]} onChange={value => edit("outcome", value)} />
        <TextArea label="Evidence note" value={draft.note} onChange={value => edit("note", value)} />
        <Field label="Source reference (optional)" value={draft.source} onChange={value => edit("source", value)} />
      </> : <>
        <Field label="Priority 1-100" type="number" value={draft.priority} onChange={value => edit("priority", Number(value))} />
        <Field label={kind === "assignment" ? "Due date (optional)" : "Review date (optional)"} type="datetime-local" value={draft.date} onChange={value => edit("date", value)} />
      </>}
      <Actions label={config.action} disabled={disabled || !valid || expired} onClick={() => void save()} />
    </fieldset>
    {expired ? <p role="alert" className="p-5 text-sm text-[#7c2f2f]">Your school session changed. Sign out and sign in again before recording learning.</p>
      : message && <p aria-live="polite" role={failed ? "alert" : undefined} className={`p-5 text-sm ${failed ? "text-[#7c2f2f]" : "text-[#42506b]"}`}>{message}</p>}
    {refreshFailed && !expired && <Actions label="Refresh saved records" disabled={disabled} onClick={() => void refreshSaved()} />}
  </Panel>;
}
