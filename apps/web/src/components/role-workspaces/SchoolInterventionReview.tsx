"use client";

import { useCallback, useState } from "react";
import { useSchoolSave } from "./useSchoolSave";
import { Actions, Field, LabeledSelect, LearnerScopeNotice, Panel, TextArea } from "./SchoolWorkspacePrimitives";

type Learner = { external_ref: string; display_name: string; year_group: number };
type Intervention = { id?: string; student_external_ref: string; student_display_name?: string; title: string; status?: string };
const emptyDraft = (id = "", outcome = "monitor") => ({ intervention_id: id, outcome, evidence_note: "", next_review_due_at: "" });
const savedMessage = "Intervention reassessment saved.";

// The workspace keys this component by pupil and explicit review selection.
// A request key belongs to an immutable pupil/intervention/payload, not a click.
export default function SchoolInterventionReview({ learner, initialID, interventions, disabled, request, onSaved, onBusyChange }: {
  learner?: Learner; initialID: string; interventions: Intervention[]; disabled: boolean;
  request: (path: string, options: RequestInit) => Promise<unknown>;
  onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => emptyDraft(initialID, interventions.find(item => item.id === initialID)?.status === "monitoring" ? "complete" : "monitor"));
  const resetDraft = useCallback(() => setDraft(emptyDraft()), []);
  const { message, failed, refreshFailed, expired, save: persist, refresh } = useSchoolSave({ disabled, request, onSaved, onBusyChange, resetDraft, savedMessage });
  const scoped = interventions.filter(item => item.id && learner && item.student_external_ref === learner.external_ref);
  const selected = scoped.find(item => item.id === draft.intervention_id);
  const valid = !!learner && !!selected && !!draft.evidence_note.trim()
    && (draft.outcome === "complete" || !!draft.next_review_due_at)
    && (!draft.next_review_due_at || Number.isFinite(Date.parse(draft.next_review_due_at)));

  async function save() {
    if (!valid || !learner) return;
    const body = JSON.stringify({ outcome: draft.outcome, evidence_note: draft.evidence_note.trim(), next_review_due_at: draft.next_review_due_at ? new Date(draft.next_review_due_at).toISOString() : "" });
    await persist({ path: `/v1/school/interventions/${encodeURIComponent(draft.intervention_id)}/reviews`, body, pupil: learner.external_ref });
  }

  return <Panel title="Review Intervention Evidence">
    <LearnerScopeNotice purpose="intervention reassessment" learner={learner} />
    <fieldset disabled={disabled || !learner || expired}>
      <LabeledSelect label="Intervention" value={draft.intervention_id} values={["", ...scoped.map(item => item.id!)]}
        labels={Object.fromEntries(scoped.map(item => [item.id!, `${item.student_display_name || item.student_external_ref}: ${item.title}`]))}
        onChange={id => setDraft(emptyDraft(id, scoped.find(item => item.id === id)?.status === "monitoring" ? "complete" : "monitor"))} />
      <LabeledSelect label="Review outcome" value={draft.outcome} values={["continue", "monitor", "complete", "reopen"]} onChange={outcome => setDraft(current => ({ ...current, outcome }))} />
      <TextArea label="Reassessment evidence" value={draft.evidence_note} onChange={evidence_note => setDraft(current => ({ ...current, evidence_note }))} />
      <Field label="Next review date" type="datetime-local" value={draft.next_review_due_at} onChange={next_review_due_at => setDraft(current => ({ ...current, next_review_due_at }))} />
      <Actions label="Save reassessment" disabled={disabled || expired || !valid} onClick={() => void save()} />
    </fieldset>
    {expired ? <p role="alert" className="p-5 text-sm text-[#7c2f2f]">Your school session changed. Sign out and sign in again before recording learning.</p>
      : message && <p aria-live="polite" role={failed ? "alert" : undefined} className={`p-5 text-sm ${failed ? "text-[#7c2f2f]" : "text-[#42506b]"}`}>{message}</p>}
    {refreshFailed && !expired && <Actions label="Refresh saved records" disabled={disabled} onClick={() => void refresh()} />}
  </Panel>;
}
