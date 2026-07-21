import type { ProgressReport, ProgressSubject } from "@/lib/api";

const SUBJECT_ACCENTS: Record<string, string> = {
  English: "#f7a6d8",
  Mathematics: "#55cbd3",
  Science: "#8be28f",
};

export default function ProgressSnapshot({
  progress,
  empty,
  tone = "indigo",
}: {
  progress: ProgressReport | null;
  empty: string;
  tone?: "indigo" | "navy";
}) {
  const ink = tone === "navy" ? "#17233f" : "#1d1a3e";

  if (!progress) {
    return <p className="border-t border-[#1d1a3e]/10 p-5 text-sm" style={{ color: `${ink}94` }}>{empty}</p>;
  }

  return (
    <div className="grid gap-3 border-t border-[#1d1a3e]/10 p-5">
      <p className="text-sm leading-6" style={{ color: `${ink}b0` }}>{progress.summary}</p>
      {progress.subjects.map((subject) => <ProgressSubjectCard key={subject.subject} subject={subject} ink={ink} />)}
      {progress.mock_assessments?.length > 0 && (
        <section className="rounded-lg border border-[#1d1a3e]/10 bg-[#f3efff] p-4" aria-label="Mock assessment history">
          <p className="font-display text-sm font-semibold">Subject checks</p>
          <div className="mt-2 grid gap-2">
            {progress.mock_assessments.slice(0, 4).map((assessment) => (
              <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs">
                <span className="font-semibold">{assessment.title}</span>
                <span>{assessment.status === "completed" ? `${assessment.score}% · ${assessment.correct_count}/${assessment.question_count}` : `${assessment.answered_count}/${assessment.question_count} saved`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProgressSubjectCard({ subject, ink }: { subject: ProgressSubject; ink: string }) {
  const accent = SUBJECT_ACCENTS[subject.subject] ?? "#7357c9";
  const average = clamp(subject.average_score);
  const sampled = subject.objective_count > 0
    ? Math.round((subject.sampled_objectives / subject.objective_count) * 100)
    : 0;
  const currentYear = subject.current_year || subject.working_year;

  return (
    <article className="rounded-lg border border-[#1d1a3e]/10 bg-[#fbfaf6] p-4" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
          <p className="font-display font-semibold">{subject.subject}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{progressLabel(subject.status)}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold" style={{ color: `${ink}94` }}>
          <span>Average evidence</span>
          <span>{average}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#1d1a3e]/8" role="progressbar" aria-label={`${subject.subject} average evidence`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={average}>
          <div className="h-full rounded-full" style={{ width: `${average}%`, backgroundColor: accent }} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5" style={{ color: `${ink}94` }}>
        Working at Year {subject.working_year} · {subject.sampled_objectives}/{subject.objective_count} Year {currentYear} objectives sampled
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={`${subject.subject} progression pathway`}>
        <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold">Y{currentYear} core</span>
        {subject.stretch_allowed && <span className="rounded-full px-2.5 py-1 text-[0.68rem] font-semibold" style={{ backgroundColor: `${accent}35` }}>Y{subject.stretch_year} stretch</span>}
        <span className="rounded-full bg-[#1d1a3e]/6 px-2.5 py-1 text-[0.68rem] font-semibold" title="Earlier-year objectives remain eligible for spaced revision.">
          {sampled}% sampled
        </span>
      </div>

      {subject.years.length > 0 && (
        <div className="mt-4 grid grid-cols-7 gap-1" aria-label={`${subject.subject} year-group evidence statuses`}>
          {subject.years.map((year) => {
            const yearAverage = year.sampled_objectives ? Math.max(8, clamp(year.average_score)) : 4;
            return (
              <div key={year.year} className="text-center">
                <div className="mx-auto h-2 overflow-hidden rounded-full bg-[#1d1a3e]/8" role="progressbar" aria-label={`${subject.subject} Year ${year.year}: ${progressLabel(year.status)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={year.sampled_objectives ? clamp(year.average_score) : 0}>
                  <div className="h-full rounded-full" style={{ width: `${yearAverage}%`, backgroundColor: year.year === subject.working_year ? accent : `${accent}99` }} />
                </div>
                <span className="mt-1 block text-[0.62rem] font-semibold" style={{ color: `${ink}88` }}>Y{year.year}</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-5" style={{ color: `${ink}78` }}>
        {subject.stretch_allowed
          ? `Progress in ${subject.subject} can stretch independently to Year ${subject.stretch_year}; earlier skills remain in the revision cycle.`
          : `Continue the Year ${subject.working_year} route while the system gathers more varied evidence.`}
      </p>
    </article>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function progressLabel(status: string) {
  switch (status) {
    case "ahead": return "Ahead";
    case "secure": return "Secure";
    case "on_track": return "On track";
    case "needs_practice": return "Needs practice";
    default: return "Not sampled";
  }
}
