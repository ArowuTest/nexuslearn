import type { ProgressReport } from "@/lib/api";

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
  return progress ? (
    <div className="grid gap-3 border-t border-[#1d1a3e]/10 p-5">
      <p className="text-sm leading-6" style={{ color: `${ink}b0` }}>{progress.summary}</p>
      {progress.subjects.map((subject) => (
        <article key={subject.subject} className="rounded-lg border border-[#1d1a3e]/10 bg-[#fbfaf6] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display font-semibold">{subject.subject}</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{subject.status.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: `${ink}94` }}>
            Working at Year {subject.working_year} · {subject.sampled_objectives}/{subject.objective_count} objectives sampled · {subject.average_score}% average evidence
          </p>
        </article>
      ))}
    </div>
  ) : <p className="border-t border-[#1d1a3e]/10 p-5 text-sm" style={{ color: `${ink}94` }}>{empty}</p>;
}
