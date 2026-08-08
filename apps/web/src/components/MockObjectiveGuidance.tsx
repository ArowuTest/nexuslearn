import type { MockObjectiveResult } from "@/lib/api";

const STATUS_LABELS: Record<MockObjectiveResult["status"], string> = {
  review_next: "Review next",
  practising: "Practising",
  secure_for_now: "Secure for now",
  not_sampled: "Not sampled",
};

const STATUS_STYLES: Record<MockObjectiveResult["status"], string> = {
  review_next: "bg-[#fff0d6] text-[#714600]",
  practising: "bg-[#e8e3ff] text-[#49358d]",
  secure_for_now: "bg-[#dff5e7] text-[#236846]",
  not_sampled: "bg-[#e9e8ec] text-[#565267]",
};

const STATUS_ORDER: Record<MockObjectiveResult["status"], number> = {
  review_next: 0,
  practising: 1,
  secure_for_now: 2,
  not_sampled: 3,
};

export default function MockObjectiveGuidance({
  results,
  compact = false,
}: {
  results: MockObjectiveResult[];
  compact?: boolean;
}) {
  if (!results.length) return null;
  const ordered = [...results].sort((left, right) =>
    STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
      || left.year_group - right.year_group
      || left.topic.localeCompare(right.topic),
  );

  return (
    <section className="mt-4 rounded-xl border border-[#17233f]/10 bg-white p-4 text-left" aria-label="What this check sampled">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-[#17233f]">What this check sampled</h3>
          <p className="mt-1 text-xs leading-5 text-[#17233f]/65">This is sampled evidence, not a limit on progress or a replacement for wider teaching evidence.</p>
        </div>
        <span className="rounded-full bg-[#f3efff] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5a3ca8]">{results.length} objective{results.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {ordered.map((result) => (
          <article key={result.objective_id} className="rounded-lg border border-[#17233f]/8 bg-[#fbfaf6] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#465064]">Year {result.year_group} · {result.strand}</p>
                <p className="mt-1 text-sm font-semibold text-[#17233f]">{result.topic || result.statement}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${STATUS_STYLES[result.status]}`}>{STATUS_LABELS[result.status]}</span>
            </div>
            {!compact && result.statement && <p className="mt-2 text-xs leading-5 text-[#17233f]/72">{result.statement}</p>}
            <p className="mt-2 text-xs font-semibold text-[#17233f]/78">{result.correct_count}/{result.question_count} correct in this sample · {result.score}%</p>
            {!compact && <p className="mt-1 text-xs leading-5 text-[#17233f]/68">{result.guidance}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
