"use client";

import { useEffect, useMemo, useState } from "react";
import AdminReleaseGate from "@/components/admin/AdminReleaseGate";
import {
  getAIReviews,
  getAIReviewSummary,
  saveAIReview,
  type AIReviewEvidence,
  type AIReviewQuery,
  type AIReviewStatus,
  type AIReviewSummary,
} from "@/lib/admin-reviews";

const EMPTY_SUMMARY: AIReviewSummary = {
  packs: 0, variants: 0, current_ai_curriculum_lead: 0, current_ai_send_lead: 0,
  stale: 0, revision_required: 0, escalation_required: 0, blocking_findings: 0,
  escalation_findings: 0, controlled_pilot_allowed: false,
};

export default function AdminReviewWorkspace() {
  const [filters, setFilters] = useState<AIReviewQuery>({ limit: 25 });
  const [items, setItems] = useState<AIReviewEvidence[]>([]);
  const [summary, setSummary] = useState<AIReviewSummary>(EMPTY_SUMMARY);
  const [selectedID, setSelectedID] = useState("");
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading governed review evidence…");
  const [implementation, setImplementation] = useState("");
  const [modelIdentifier, setModelIdentifier] = useState("");
  const [confidence, setConfidence] = useState("0.95");
  const [evidenceNotes, setEvidenceNotes] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return Promise.all([getAIReviews(filters), getAIReviewSummary()]);
      })
      .then(([page, latestSummary]) => {
        if (!active) return;
        setItems(page.items ?? []);
        setSummary(latestSummary);
        setNextCursor(page.next_cursor ?? "");
        const chosen = page.items?.find((item) => item.id === selectedID) ?? page.items?.[0];
        if (chosen) selectReview(chosen);
        else setSelectedID("");
        setMessage(page.items?.length ? `${page.items.length} governed review records loaded.` : "No evidence matches these filters.");
      })
      .catch((error) => {
        if (!active) return;
        setItems([]);
        setNextCursor("");
        setMessage(error instanceof Error ? error.message : "Could not load AI review evidence.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // A filter change intentionally refreshes the queue; selection is rehydrated from that response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const selected = useMemo(() => items.find((item) => item.id === selectedID) ?? items[0], [items, selectedID]);

  function selectReview(review: AIReviewEvidence) {
    setSelectedID(review.id ?? "");
    setImplementation(review.reviewer_implementation);
    setModelIdentifier(review.model_identifier);
    setConfidence(String(review.confidence));
    setEvidenceNotes(review.evidence_notes);
  }

  const approvalBlocked = !selected || selected.stale || summary.stale > 0 || selected.source_ids.length === 0 ||
    selected.findings.some((finding) => finding.severity === "blocking" || finding.severity === "escalation") ||
    Object.values(selected.criterion_results).some((criterion) => typeof criterion === "object" && criterion !== null && ["not_met", "failed"].includes(String(criterion.result)));

  function updateFilter(key: keyof AIReviewQuery, value: string) {
    setFilters((current) => ({ ...current, [key]: value, cursor: undefined }));
  }

  async function recordDecision(status: AIReviewStatus) {
    if (!selected) return;
    if (!implementation.trim() || implementation.trim() === selected.reviewer_implementation) {
      setMessage("Enter a new reviewer implementation revision so the prior immutable decision remains auditable.");
      return;
    }
    try {
      setLoading(true);
      const saved = await saveAIReview({
        ...selected,
        id: undefined,
        created_at: undefined,
        stale: false,
        status,
        reviewer_implementation: implementation.trim(),
        model_identifier: modelIdentifier.trim(),
        confidence: Number(confidence),
        evidence_notes: evidenceNotes.trim(),
        supersedes_id: selected.id,
      });
      setItems((current) => [saved, ...current]);
      selectReview(saved);
      setSummary(await getAIReviewSummary());
      setMessage(`Governed ${laneLabel(saved.lane_id)} decision recorded as ${statusLabel(saved.status)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save governed review evidence.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 grid gap-6" aria-labelledby="ai-review-heading">
      <header className="bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7357c9]">Governed evidence workspace</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="ai-review-heading" className="font-display text-3xl font-semibold">Curriculum and SEND review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#565267]">Inspect exact content hashes, rubric outcomes, sources and revision findings across Years 1–7.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-sm">
            <Metric value={summary.packs} label="packs" />
            <Metric value={summary.variants} label="variants covered" />
          </div>
        </div>
        <p className="mt-4 border-l-4 border-[#7357c9] bg-[#f0ecff] px-4 py-3 text-sm font-semibold text-[#39286f]">AI review evidence — not independent human professional approval.</p>
      </header>

      <AdminReleaseGate summary={summary} />

      <section className="bg-white p-5 shadow-card" aria-label="AI review filters">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <FilterSelect label="Review lane" value={filters.lane_id ?? ""} onChange={(value) => updateFilter("lane_id", value)} options={[["", "All lanes"], ["ai_curriculum_lead", "AI Curriculum Lead"], ["ai_send_lead", "AI SEND Lead"]]} />
          <FilterSelect label="Decision status" value={filters.status ?? ""} onChange={(value) => updateFilter("status", value)} options={[["", "All statuses"], ["approved", "Approved"], ["approved_with_observation", "Approved with observation"], ["revision_required", "Revision required"], ["escalation_required", "Escalation required"]]} />
          <FilterSelect label="Risk tier" value={filters.risk_tier ?? ""} onChange={(value) => updateFilter("risk_tier", value)} options={[["", "All risks"], ["tier_1", "Tier 1"], ["tier_2", "Tier 2"], ["tier_3", "Tier 3"]]} />
          <FilterSelect label="Year group" value={filters.year_group ?? ""} onChange={(value) => updateFilter("year_group", value)} options={[["", "All years"], ...Array.from({ length: 7 }, (_, index) => [String(index + 1), `Year ${index + 1}`])]} />
          <FilterInput label="Subject" value={filters.subject ?? ""} onChange={(value) => updateFilter("subject", value)} />
          <FilterInput label="Pack ID" value={filters.pack_id ?? ""} onChange={(value) => updateFilter("pack_id", value)} />
        </div>
        <p className="mt-4 text-sm text-[#565267]" role="status">{loading ? "Loading governed evidence…" : message}</p>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="overflow-hidden bg-white shadow-card" aria-label="AI review queue">
          <div className="border-b border-[#1d1a3e]/10 p-5"><h3 className="font-display text-2xl font-semibold">Review queue</h3></div>
          <div className="divide-y divide-[#1d1a3e]/8">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => selectReview(item)} className={`block w-full p-5 text-left ${selected?.id === item.id ? "bg-[#f0ecff]" : "hover:bg-[#fbfaf6]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="break-all font-semibold">{item.content_id}</span>
                  <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                </div>
                <p className="mt-2 text-sm text-[#565267]">Year {item.year_group} · {item.subject} · {laneLabel(item.lane_id)} · {item.risk_tier.replace("_", " ")}</p>
              </button>
            ))}
            {!loading && items.length === 0 && <p className="p-5 text-sm text-[#565267]">No governed evidence matches this filter.</p>}
          </div>
          <div className="flex justify-end border-t border-[#1d1a3e]/10 p-4">
            <button type="button" aria-label="Next review page" disabled={!nextCursor || loading} onClick={() => setFilters((current) => ({ ...current, cursor: nextCursor }))} className="btn-pop bg-[#f6f3ea] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45">Next review page</button>
          </div>
        </section>

        {selected && (
          <section className="grid gap-5" aria-label="Selected AI review evidence">
            <article className="bg-white p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs uppercase tracking-[0.14em] text-[#7357c9]">{laneLabel(selected.lane_id)}</p><h3 className="mt-2 break-all font-display text-2xl font-semibold">{selected.content_id}</h3></div>
                <span className={statusClass(selected.status)}>{statusLabel(selected.status)}</span>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <EvidenceFact label="Pack" value={selected.pack_id} />
                <EvidenceFact label="Material" value={`${selected.content_type} · revision ${selected.content_revision}`} />
                <EvidenceFact label="Content hash" value={selected.content_hash} mono />
                <EvidenceFact label="Governance" value={`${selected.rubric_revision} · ${selected.source_set_revision}`} />
                <EvidenceFact label="Implementation" value={`${selected.reviewer_implementation} · ${selected.model_identifier}`} />
                <EvidenceFact label="Coverage" value={`${selected.reviewed_variant_ids.length.toLocaleString()} variant IDs · confidence ${Math.round(selected.confidence * 100)}%`} />
              </dl>
              {selected.supersedes_id && <p className="mt-4 text-xs text-[#565267]">Supersedes evidence {selected.supersedes_id}</p>}
              {selected.stale && <p className="mt-4 bg-[#ffe8e8] px-4 py-3 text-sm font-semibold text-[#8b2b2b]">This evidence is stale and cannot support release.</p>}
            </article>

            <article className="bg-white p-6 shadow-card">
              <h3 className="font-display text-2xl font-semibold">Criterion evidence</h3>
              <div className="mt-4 grid gap-3">
                {Object.entries(selected.criterion_results).map(([criterionID, outcome]) => {
                  const result = typeof outcome === "object" && outcome !== null ? outcome.result : String(outcome ?? "");
                  const evidence = typeof outcome === "object" && outcome !== null ? outcome.evidence : "";
                  return <div key={criterionID} className="border border-[#1d1a3e]/10 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{humanise(criterionID)}</p><span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7357c9]">{humanise(result ?? "not recorded")}</span></div>{evidence && <p className="mt-2 text-sm leading-6 text-[#565267]">{evidence}</p>}</div>;
                })}
              </div>
            </article>

            <article className="bg-white p-6 shadow-card">
              <h3 className="font-display text-2xl font-semibold">Findings and required revisions</h3>
              <div className="mt-4 grid gap-3">
                {selected.findings.map((finding, index) => (
                  <div key={finding.id ?? `${finding.finding_code}-${index}`} className={`border-l-4 p-4 ${finding.severity === "observation" ? "border-[#d29a25] bg-[#fff8e4]" : "border-[#c95757] bg-[#fff0f0]"}`}>
                    <p className="font-semibold">{humanise(finding.finding_code)} · {finding.severity}</p>
                    <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/68">{finding.rationale}</p>
                    {finding.required_revisions.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{finding.required_revisions.map((revision) => <li key={revision}>{revision}</li>)}</ul>}
                  </div>
                ))}
                {selected.findings.length === 0 && <p className="text-sm text-[#565267]">No governed findings were recorded.</p>}
              </div>
              <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-[#565267]">Authoritative sources</h4>
              <div className="mt-3 flex flex-wrap gap-2">{selected.source_ids.map((source) => <span key={source} className="bg-[#e8e2ff] px-3 py-2 text-xs font-semibold text-[#4e33a4]">{source}</span>)}</div>
            </article>

            <article className="bg-white p-6 shadow-card">
              <h3 className="font-display text-2xl font-semibold">Record a superseding AI decision</h3>
              <p className="mt-2 text-sm leading-6 text-[#565267]">Use this only after the content or reviewer implementation has genuinely changed. The previous decision remains immutable.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <EditorInput label="Reviewer implementation revision" value={implementation} onChange={setImplementation} />
                <EditorInput label="Model identifier" value={modelIdentifier} onChange={setModelIdentifier} />
                <EditorInput label="Confidence (0–1)" value={confidence} onChange={setConfidence} />
                <label className="sm:col-span-2"><span className="text-sm font-semibold">Evidence notes</span><textarea value={evidenceNotes} onChange={(event) => setEvidenceNotes(event.target.value)} rows={4} className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]" /></label>
              </div>
              {approvalBlocked && <p className="mt-4 bg-[#fff8e4] px-4 py-3 text-sm text-[#725100]">Approval is disabled while blocking criteria, stale evidence, missing sources or governed findings remain.</p>}
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" disabled={loading} onClick={() => void recordDecision("revision_required")} className="btn-pop bg-[#f6f3ea] px-5 py-3 text-sm disabled:opacity-45">Record revision required</button>
                <button type="button" disabled={loading || approvalBlocked} onClick={() => void recordDecision("approved")} className="btn-pop bg-[#55cbd3] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45">Approve governed evidence</button>
              </div>
            </article>
          </section>
        )}
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="bg-[#f6f3ea] px-4 py-3"><p className="font-display text-2xl font-semibold">{value.toLocaleString()}</p><p className="text-xs font-semibold text-[#565267]">{label}</p></div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label><span className="text-sm font-semibold">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-[#1d1a3e]/15 bg-white px-3 py-3 text-sm outline-none focus:border-[#7357c9]">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function FilterInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="text-sm font-semibold">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-[#1d1a3e]/15 px-3 py-3 text-sm outline-none focus:border-[#7357c9]" /></label>;
}

function EditorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="text-sm font-semibold">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]" /></label>;
}

function EvidenceFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border border-[#1d1a3e]/10 p-3"><dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#565267]">{label}</dt><dd className={`mt-1 break-all text-sm text-[#1d1a3e]/72 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>;
}

function laneLabel(lane: string) { return lane === "ai_send_lead" ? "AI SEND Lead" : "AI Curriculum Lead"; }
function statusLabel(status: string) { return humanise(status); }
function humanise(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function statusClass(status: string) {
  const colour = status === "approved" ? "bg-[#dff7e7] text-[#17633a]" : status === "approved_with_observation" ? "bg-[#fff4d5] text-[#725100]" : "bg-[#ffe8e8] text-[#8b2b2b]";
  return `${colour} px-3 py-1 text-xs font-semibold`;
}
