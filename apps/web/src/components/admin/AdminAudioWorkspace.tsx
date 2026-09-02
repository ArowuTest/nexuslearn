"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_AUDIO_FILTERS,
  audioFiltersFromSearch,
  loadAudioQueue,
  requestAudioRerecord,
  saveAudioReview,
  syncAudioFiltersToURL,
  type AdminRequest,
  type AudioQueueFilters,
  type NarrationQueueItem,
  type NarrationQueuePage,
  type NarrationReadinessReport,
} from "@/lib/admin-audio";

type ReviewDraft = {
  reviewerName: string;
  notes: string;
  reason: string;
  criteria: Record<string, boolean>;
};

const criteria = [
  ["natural", "Natural, warm voice"],
  ["clear", "Clear and intelligible"],
  ["pronunciation", "Accurate pronunciation"],
  ["age_suitable", "Age-suitable pace and tone"],
] as const;

const rerecordReasons = [
  ["", "Choose a reason"],
  ["pronunciation", "Pronunciation"],
  ["naturalness", "Naturalness / robotic delivery"],
  ["clarity", "Clarity"],
  ["age_suitability", "Age suitability"],
  ["pace", "Pace"],
  ["technical", "Technical audio issue"],
  ["transcript_change", "Transcript changed"],
  ["other", "Other"],
] as const;

function draftFor(item: NarrationQueueItem): ReviewDraft {
  const review = item.review?.stale ? undefined : item.review;
  return {
    reviewerName: review?.reviewer_name ?? "",
    notes: review?.notes ?? "",
    reason: review?.rejection_reasons?.[0] ?? "",
    criteria: review?.criteria ?? {},
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#1d1a3e]/8 bg-white p-4">
      <p className="font-display text-2xl font-semibold text-[#17233f]">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-semibold text-[#1d1a3e]/62">{label}</p>
    </div>
  );
}

function shortHash(value?: string) {
  if (!value) return "legacy manifest — no v2 binding";
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

export default function AdminAudioWorkspace({ request, readiness }: { request: AdminRequest; readiness: NarrationReadinessReport | null }) {
  const [filters, setFilters] = useState<AudioQueueFilters>(() =>
    typeof window === "undefined" ? DEFAULT_AUDIO_FILTERS : audioFiltersFromSearch(window.location.search),
  );
  const [queue, setQueue] = useState<NarrationQueuePage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [playbackErrors, setPlaybackErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("Loading the governed listening queue…");

  async function refresh(nextFilters: AudioQueueFilters, offset = 0, announce = true) {
    setLoading(true);
    try {
      const nextQueue = await loadAudioQueue(request, nextFilters, offset);
      setQueue(nextQueue);
      if (announce) setMessage(`${nextQueue.total.toLocaleString()} matching audio assets loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the audio listening queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(filters, 0), 0);
    return () => window.clearTimeout(initialLoad);
    // The initial filter snapshot is intentionally restored once from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter<K extends keyof AudioQueueFilters>(field: K, value: AudioQueueFilters[K]) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function itemDraft(item: NarrationQueueItem) {
    return drafts[item.asset_id] ?? draftFor(item);
  }

  function updateDraft(item: NarrationQueueItem, patch: Partial<ReviewDraft>) {
    setDrafts((current) => ({ ...current, [item.asset_id]: { ...itemDraft(item), ...patch } }));
  }

  async function submitReview(item: NarrationQueueItem, decision: "approved" | "rejected") {
    const draft = itemDraft(item);
    const checkedCriteria = Object.fromEntries(criteria.map(([id]) => [id, Boolean(draft.criteria[id])]));
    if (!draft.reviewerName.trim()) {
      setMessage("Add the named reviewer before recording a listening decision.");
      return;
    }
    if (decision === "approved" && Object.values(checkedCriteria).some((value) => !value)) {
      setMessage("Confirm all four listening criteria before approval.");
      return;
    }
    if (decision === "rejected" && (!draft.reason || !draft.notes.trim())) {
      setMessage("Choose a structured re-record reason and add an evidence note.");
      return;
    }
    if (decision === "rejected" && !queue?.release_id) {
      setMessage("This queue is using a legacy manifest. Import the signed v2 audio release before requesting a re-record.");
      return;
    }

    setSaving(item.asset_id);
    try {
      await saveAudioReview(request, item, {
        decision,
        reviewerName: draft.reviewerName,
        criteria: checkedCriteria,
        rejectionReason: draft.reason,
        notes: draft.notes,
      });
      if (decision === "rejected") {
        await requestAudioRerecord(request, queue!.release_id!, item, draft.reason, draft.notes);
        setMessage(`Re-record request recorded for ${item.asset_id}. The immutable release asset remains available for audit.`);
      } else {
        setMessage(`${item.asset_id} approved against the current transcript, audio and production profile.`);
      }
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([assetID]) => assetID !== item.asset_id)));
      const refreshOffset = queue && queue.items.length === 1 && queue.offset > 0 ? Math.max(0, queue.offset - queue.limit) : queue?.offset ?? 0;
      await refresh(filters, refreshOffset, false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record the listening decision.");
    } finally {
      setSaving("");
    }
  }

  function applyFilters() {
    syncAudioFiltersToURL(filters);
    void refresh(filters, 0);
  }

  const counts = queue?.counts ?? { awaiting: 0, approved: 0, rejected: 0, stale: 0 };
  const outstanding = counts.awaiting + counts.rejected + counts.stale;

  return (
    <section aria-labelledby="audio-workspace-title" className="space-y-5">
      <div className="rounded-3xl bg-[#17233f] p-5 text-white shadow-card md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8be0df]">Audio operations</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 id="audio-workspace-title" className="font-display text-3xl font-semibold">Audio listening QA</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/78">
              Listen to the exact produced file, verify the displayed transcript and profile, then record a named human decision. Technical checks never substitute for listening approval.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${outstanding === 0 && queue ? "bg-[#dff7e7] text-[#28613c]" : "bg-[#fff4d5] text-[#725100]"}`}>
            {outstanding === 0 && queue ? "listening gate clear" : `${outstanding.toLocaleString()} need action`}
          </span>
        </div>
        {queue?.release_id ? (
          <p className="mt-4 break-all rounded-2xl bg-white/8 px-4 py-3 text-xs text-white/72">Signed release: {queue.release_id}</p>
        ) : queue ? (
          <p className="mt-4 rounded-2xl bg-[#fff4d5] px-4 py-3 text-xs font-semibold text-[#725100]">Legacy manifest active: review decisions remain available, but governed re-record requests require a signed v2 release import.</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Audio quality totals">
        <Metric label="Scripts" value={readiness?.totals.expected_assets ?? queue?.total ?? 0} />
        <Metric label="Technical pass" value={readiness?.totals.technical_pass ?? 0} />
        <Metric label="Awaiting listening" value={counts.awaiting} />
        <Metric label="Approved" value={counts.approved} />
        <Metric label="Re-record" value={counts.rejected} />
        <Metric label="Stale decisions" value={counts.stale} />
      </div>

      <section className="rounded-3xl border border-[#1d1a3e]/8 bg-[#f8fbff] p-4 shadow-card md:p-5" aria-labelledby="audio-filter-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="audio-filter-title" className="font-display text-xl font-semibold">Listening queue</h2>
            <p className="mt-1 text-sm text-[#1d1a3e]/62">Filters are saved in the page URL so a review lane can be shared or resumed.</p>
          </div>
          <p aria-live="polite" role="status" className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#155d64]">{message}</p>
        </div>

        <form className="mt-4 grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          <label className="text-xs font-semibold text-[#1d1a3e]/68">Decision status
            <select aria-label="Audio decision status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value as AudioQueueFilters["status"])} className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 bg-white px-3 text-sm font-normal">
              <option value="awaiting">Awaiting listening</option><option value="rejected">Re-record required</option><option value="stale">Stale decisions</option><option value="approved">Approved</option><option value="all">All statuses</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#1d1a3e]/68">Subject
            <select aria-label="Audio subject" value={filters.subject} onChange={(event) => updateFilter("subject", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 bg-white px-3 text-sm font-normal">
              <option value="">All subjects</option><option>English</option><option>Mathematics</option><option>Science</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#1d1a3e]/68">Year
            <select aria-label="Audio year" value={filters.year} onChange={(event) => updateFilter("year", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 bg-white px-3 text-sm font-normal">
              <option value="">All years</option>{[1, 2, 3, 4, 5, 6, 7].map((year) => <option key={year} value={year}>Year {year}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#1d1a3e]/68">Asset type
            <select aria-label="Audio asset type" value={filters.kind} onChange={(event) => updateFilter("kind", event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 bg-white px-3 text-sm font-normal">
              <option value="">All types</option><option value="lesson">Lessons</option><option value="vocabulary">Vocabulary</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[#1d1a3e]/68">Search
            <input aria-label="Search audio queue" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Pack, script or asset" className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 px-3 text-sm font-normal" />
          </label>
          <button type="submit" disabled={loading} className="btn-pop mt-auto min-h-11 rounded-xl bg-[#155d64] px-4 text-sm font-semibold text-white disabled:opacity-50">Apply audio filters</button>
        </form>

        {!loading && queue?.items.length === 0 && <p className="mt-4 rounded-2xl border border-[#64b983]/35 bg-[#effaf3] p-4 text-sm text-[#28613c]">No recordings match these filters. Change the decision or curriculum filters to continue.</p>}

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {(queue?.items ?? []).map((item) => {
            const draft = itemDraft(item);
            const stale = item.status === "stale" || item.review?.stale;
            return (
              <article key={item.asset_id} className="rounded-3xl border border-[#1d1a3e]/10 bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-semibold text-[#17233f]">{item.asset_id}</p>
                    <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/62">Year {item.year || "?"} · {item.subject} · {item.kind} · {item.pack_id}</p>
                  </div>
                  <span className="rounded-full bg-[#55cbd3]/12 px-3 py-1 text-xs font-semibold text-[#155d64]">#{item.rank}</span>
                </div>

                {stale && <div className="mt-4 rounded-2xl border border-[#f0b35a]/50 bg-[#fff8e8] p-3 text-sm text-[#725100]" role="alert"><strong>The previous decision is stale.</strong> Re-listen and create a new decision against the current file and profile.</div>}

                <audio className="mt-4 w-full" controls preload="metadata" src={item.file} aria-label={`Listen to ${item.asset_id}`} onError={() => setPlaybackErrors((current) => ({ ...current, [item.asset_id]: true }))} onCanPlay={() => setPlaybackErrors((current) => ({ ...current, [item.asset_id]: false }))} />
                {playbackErrors[item.asset_id] && <p className="mt-2 rounded-xl bg-[#fff1f1] p-3 text-xs text-[#8b2b2b]" role="alert">Audio playback failed. Do not approve this asset; verify the file or request a technical re-record.</p>}

                <div className="mt-4 rounded-2xl border-l-4 border-[#f0b35a] bg-[#fffaf0] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#725100]">Exact transcript</p>
                  <p className="mt-2 text-sm leading-6 text-[#1d1a3e]">{item.text_preview}</p>
                </div>

                <div className="mt-3 grid gap-2 rounded-2xl bg-[#f4f1ff] p-4 text-xs text-[#1d1a3e]/70 sm:grid-cols-2">
                  <p><strong>Voice:</strong> {item.voice_name ?? queue?.voice_name ?? "manifest voice"}</p>
                  <p><strong>Model:</strong> {item.model_id ?? queue?.model_id ?? "manifest model"}</p>
                  <p><strong>Used by {item.reference_count ?? item.reuse_count ?? 1} learning references</strong></p>
                  <p><strong>Canonical reuse:</strong> {item.reuse_count ?? 1}</p>
                </div>
                <details className="mt-3 text-xs leading-5 text-[#1d1a3e]/68">
                  <summary className="cursor-pointer font-semibold">Immutable identity and technical hashes</summary>
                  <dl className="mt-2 grid gap-1 break-all">
                    <div><dt className="inline font-semibold">Profile: </dt><dd className="inline">{shortHash(item.production_profile_sha256)}</dd></div>
                    <div><dt className="inline font-semibold">Production identity: </dt><dd className="inline">{shortHash(item.production_identity_sha256)}</dd></div>
                    <div><dt className="inline font-semibold">Transcript SHA-256: </dt><dd className="inline">{item.text_sha256}</dd></div>
                    <div><dt className="inline font-semibold">Audio SHA-256: </dt><dd className="inline">{item.audio_sha256}</dd></div>
                  </dl>
                </details>

                <fieldset className="mt-4">
                  <legend className="text-xs font-semibold text-[#1d1a3e]/68">Approval criteria</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {criteria.map(([id, label]) => <label key={id} className="rounded-xl border border-[#1d1a3e]/8 p-3 text-xs text-[#1d1a3e]/72"><input type="checkbox" checked={Boolean(draft.criteria[id])} onChange={(event) => updateDraft(item, { criteria: { ...draft.criteria, [id]: event.target.checked } })} className="mr-2 accent-[#155d64]" />{label}</label>)}
                  </div>
                </fieldset>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#1d1a3e]/68">Reviewer name
                    <input aria-label="Reviewer name" value={draft.reviewerName} onChange={(event) => updateDraft(item, { reviewerName: event.target.value })} autoComplete="name" className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 px-3 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-[#1d1a3e]/68">Re-record reason
                    <select aria-label="Re-record reason" value={draft.reason} onChange={(event) => updateDraft(item, { reason: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-[#1d1a3e]/15 bg-white px-3 text-sm font-normal">
                      {rerecordReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-xs font-semibold text-[#1d1a3e]/68">Review notes
                  <textarea aria-label="Review notes" value={draft.notes} onChange={(event) => updateDraft(item, { notes: event.target.value })} maxLength={2000} placeholder="Evidence for a re-record or useful approval context" className="mt-1 min-h-24 w-full rounded-xl border border-[#1d1a3e]/15 px-3 py-2 text-sm font-normal" />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void submitReview(item, "approved")} disabled={loading || saving === item.asset_id || playbackErrors[item.asset_id]} className="btn-pop min-h-11 rounded-full bg-[#dff7e7] px-4 text-xs font-semibold text-[#28613c] disabled:opacity-45">Approve listening</button>
                  <button type="button" onClick={() => void submitReview(item, "rejected")} disabled={loading || saving === item.asset_id || !queue?.release_id} className="btn-pop min-h-11 rounded-full bg-[#fde4e4] px-4 text-xs font-semibold text-[#8b2b2b] disabled:opacity-45">Reject and request re-record</button>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#1d1a3e]/68">{item.rationale.slice(0, 2).join("; ")}</p>
              </article>
            );
          })}
        </div>

        {queue && <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#1d1a3e]/62">Showing {queue.total === 0 ? 0 : queue.offset + 1}–{Math.min(queue.offset + queue.items.length, queue.total)} of {queue.total}</p>
          <div className="flex gap-2">
            <button type="button" disabled={queue.offset === 0 || loading} onClick={() => void refresh(filters, Math.max(0, queue.offset - queue.limit))} className="btn-pop min-h-11 rounded-full border border-[#1d1a3e]/12 bg-white px-4 text-xs font-semibold disabled:opacity-40">Previous audio page</button>
            <button type="button" disabled={queue.next_offset === null || loading} onClick={() => void refresh(filters, queue.next_offset ?? 0)} className="btn-pop min-h-11 rounded-full bg-[#17233f] px-4 text-xs font-semibold text-white disabled:opacity-40">Next audio page</button>
          </div>
        </div>}
      </section>
    </section>
  );
}
