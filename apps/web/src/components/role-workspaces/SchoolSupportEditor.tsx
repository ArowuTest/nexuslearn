"use client";

import { useEffect, useRef } from "react";
import { BooleanField, ChoiceGrid, Field, LabeledSelect, Panel, TextArea } from "./SchoolWorkspacePrimitives";
import { supportChoices, supportNeeds, learningApproaches, supportFieldLabels, supportDifferences, type StudentEngagementProfile, type SupportState, type SupportEvent } from "./schoolSupportProfile";

function runtimePreviewItems(profile: StudentEngagementProfile): Array<[string, string]> {
  const approaches = new Set(profile.learning_approaches);
  const items: Array<[string, string] | null> = [
    profile.session_length === "short" || approaches.has("short_bursts")
      ? ["Short mission pacing", "The child runtime limits question count and makes completion feel reachable."]
      : null,
    profile.sensory_load === "low" || approaches.has("low_sensory") || approaches.has("reduced_motion")
      ? ["Low sensory visuals", "Motion, celebration intensity and visual noise are reduced by default."]
      : null,
    profile.audio_support || profile.communication_support === "audio_visual" || approaches.has("audio_read_aloud")
      ? ["Audio-first prompts", "Teaching steps and eligible questions surface replayable narration controls."]
      : null,
    profile.reading_support || approaches.has("simple_text") || profile.communication_support === "visual"
      ? ["Reading/visual scaffolds", "Plain-language cues and visual task steps stay visible during practice."]
      : null,
    profile.processing_support === "step_by_step" || approaches.has("worked_examples")
      ? ["Step-by-step teaching", "The mission models the idea before moving into independent questions."]
      : null,
    profile.attention_support !== "standard" || approaches.has("predictable_routine")
      ? ["Predictable routine", "The mission keeps a Learn, Practise, Finish schedule and chunked evidence flow."]
      : null,
    approaches.has("switch_access") || approaches.has("large_targets") || approaches.has("simplified_controls")
      ? ["Accessible controls", "Large targets, simplified interaction and switch scanning can be activated in mission."]
      : null,
    profile.confidence_support === "gentle" || approaches.has("confidence_first")
      ? ["Confidence-first feedback", "The companion uses calmer correction, optional confidence checks and repair hints."]
      : null,
  ];
  return items.filter((item): item is [string, string] => Boolean(item));
}


const buttonClass = "btn-pop bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50";
export default function SchoolSupportEditor({ state, pupil, disabled, onChange, onSync }: {
  state: SupportState; pupil: string; disabled: boolean;
  onChange: (event: SupportEvent) => void; onSync: (save: boolean) => void;
}) {
  const { draft, review, confirm } = state;
  const panel = useRef<HTMLElement>(null);
  const save = useRef<HTMLButtonElement>(null);
  const confirmation = useRef<HTMLButtonElement>(null);
  const hadReview = useRef(false);
  useEffect(() => {
    if (confirm) confirmation.current?.focus();
    else if (review) panel.current?.focus();
    else if (hadReview.current) save.current?.focus();
    hadReview.current = Boolean(review);
  }, [review, confirm]);
  const edit = (patch: Partial<StudentEngagementProfile>) => onChange({ type: "edit", patch });
  const runtimePreview = runtimePreviewItems(draft);
  const differences = review?.current ? supportDifferences(review.current, draft, state.interests) : [];
  return <Panel title="SENCO Pupil Support Profile">
    <div className="flex justify-end border-b border-[#17233f]/10 p-5">
      <button onClick={() => onSync(false)} disabled={!pupil || disabled} className={buttonClass}>
        {review ? "Refresh saved settings for comparison" : "Load profile"}
      </button>
    </div>
    {!state.ready && !review && <p className="px-5 pt-4 text-sm leading-6 text-[#42506b]">Choose a pupil and load their saved settings before editing. This protects their existing access and pacing supports.</p>}
    {review && <section ref={panel} tabIndex={-1} aria-label="Review changed support settings" className="m-5 min-w-0 rounded-xl border border-[#7357c9] bg-[#f7f0df] p-4 text-sm leading-6 [overflow-wrap:anywhere]">
      <h3 className="font-display text-xl font-semibold">Review changed support settings</h3>
      <p>{review.previouslySaved ? "Your earlier save succeeded, but newer settings have replaced it." : "The save needs your review."} Your complete draft is kept below. Nothing is saved automatically.</p>
      {review.current ? <>
        <p className="mt-3">Comparing saved version {review.current.version} with your draft:</p>
        <dl className="my-3 space-y-3">
          {differences.map(([label, saved, local]) => <div key={label} className="min-w-0 rounded-lg bg-white p-3">
            <dt className="font-semibold">{label}</dt>
            <dd className="whitespace-pre-wrap"><span className="font-semibold">Saved settings: </span>{saved}</dd>
            <dd className="whitespace-pre-wrap"><span className="font-semibold">Your draft: </span>{local}</dd>
          </div>)}
        </dl>
        {!differences.length && <p>No setting values differ. Review this saved version before continuing.</p>}
      </> : <p className="my-3">Current settings could not be verified. Refresh saved settings for comparison before choosing either action.</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button className={buttonClass} disabled={disabled || !review.current || confirm} onClick={() => onChange({ type: "rebase" })}>Review my draft against these settings</button>
        <button className={buttonClass} disabled={disabled || !review.current || confirm} onClick={() => onChange({ type: "confirm" })}>Use saved settings</button>
      </div>
      {confirm && <div className="mt-4">
        <p id="support-discard-confirmation">Discard your entire draft, including notes and interests, and use these saved settings? This does not save anything.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button ref={confirmation} aria-describedby="support-discard-confirmation" className={buttonClass} disabled={disabled} onClick={() => onChange({ type: "discard" })}>Confirm use saved settings</button>
          <button className={buttonClass} disabled={disabled} onClick={() => onChange({ type: "cancel" })}>Keep my draft</button>
        </div>
      </div>}
    </section>}
    <fieldset disabled={disabled || !state.ready || !pupil} className="min-w-0">
      <legend className="sr-only">Pupil support settings</legend>
      <ChoiceGrid label={supportFieldLabels.declared_support_needs} values={supportNeeds} selected={draft.declared_support_needs} onChange={declared_support_needs => edit({ declared_support_needs })} />
      <ChoiceGrid label={supportFieldLabels.learning_approaches} hint="These settings can adapt presentation and controls at runtime without changing the curriculum objective." values={learningApproaches} selected={draft.learning_approaches} onChange={learning_approaches => edit({ learning_approaches })} />
      <div className="grid md:grid-cols-2">
        {(Object.keys(supportChoices) as Array<keyof typeof supportChoices>).map(key =>
          <LabeledSelect key={key} label={supportFieldLabels[key]} value={draft[key]} values={supportChoices[key]} onChange={value => edit({ [key]: value })} />)}
      </div>
      <div className="grid border-y border-[#17233f]/10 md:grid-cols-2">
        {(["audio_support", "reading_support"] as const).map(key => <BooleanField key={key} label={supportFieldLabels[key]} checked={draft[key]} onChange={value => edit({ [key]: value })} />)}
      </div>
              <section className="p-5" aria-label="Runtime adaptation preview">
                <div className="rounded-2xl border border-[#55cbd3]/35 bg-[#f3fbfc] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xs uppercase tracking-[0.16em] text-[#155d64]">Runtime adaptation preview</p>
                      <h3 className="font-display mt-1 text-xl font-semibold text-[#17233f]">What this changes for the child</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-[#17233f]/68">
                        This preview translates SENCO choices into the mission behaviours the learner will actually experience.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#55cbd3]/18 px-4 py-2 text-sm font-semibold text-[#155d64]">
                      {runtimePreview.length || "No"} active adaptation{runtimePreview.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {runtimePreview.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {runtimePreview.map(([title, detail]) => (
                        <article key={`${title}-${detail}`} className="rounded-2xl border border-[#17233f]/10 bg-white p-4">
                          <p className="font-display text-sm font-semibold text-[#17233f]">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#17233f]/68">{detail}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#17233f]/68">
                      Select support approaches above to preview the runtime changes before saving the profile.
                    </p>
                  )}
                </div>
              </section>

      <Field label="Interests (comma separated)" value={state.interests} onChange={interests => onChange({ type: "edit", interests })} />
      <TextArea label={supportFieldLabels.notes} value={draft.notes} onChange={notes => edit({ notes })} />
      {state.base?.updated_at && <p className="px-5 pb-2 text-xs text-[#17233f]/52">Last updated {new Date(state.base.updated_at).toLocaleString()}</p>}
      <div className="flex justify-end p-5"><button ref={save} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50" disabled={!pupil || !state.ready || disabled || Boolean(review)} onClick={() => onSync(true)}>Save support profile</button></div>
    </fieldset>
  </Panel>;
}
