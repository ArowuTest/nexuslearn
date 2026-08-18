import type { ProgressReport, ProgressSubject, ProgressTopic } from "@/lib/api";

export default function FamilyProgressReport({ progress }: { progress?: ProgressReport | null }) {
  if (!progress) {
    return <div className="mt-2 rounded-lg border border-[#15213d]/10 bg-[#fbfaf6] p-3 leading-5">Progress pathway will appear after the first evidence sync.</div>;
  }
  const stretchSubjects = progress.subjects.filter((subject) => subject.stretch_allowed).map((subject) => subject.subject);
  return (
    <section className="mt-2 rounded-lg border border-[#7357c9]/18 bg-[#fbfaf6] p-4 text-[#15213d]" aria-label="Child progress report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">Progress pathway</p>
          <p className="mt-1 text-xs leading-5 text-[#4f586c]">{progress.summary || `Year ${progress.year_group} is the starting point; each subject follows its own evidence.`}</p>
        </div>
        <span className="rounded-full bg-[#8be28f]/35 px-3 py-1 text-[0.68rem] font-semibold text-[#215d26]">{stretchSubjects.length ? `${stretchSubjects.join(", ")} stretching to Y${progress.stretch_year}` : `Core route: Y${progress.year_group}`}</span>
      </div>
      <div className="mt-3 grid gap-2">{progress.subjects.map((subject) => <SubjectProgress key={subject.subject} subject={subject} />)}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <TopicList title="Practise next" topics={progress.practice.slice(0, 3)} tone="practice" empty="No current practice gap has been sampled." />
        <TopicList title="Strengths to retain" topics={progress.strengths.slice(0, 3)} tone="strength" empty="Strengths will appear as varied evidence is collected." />
      </div>
    </section>
  );
}

function SubjectProgress({ subject }: { subject: ProgressSubject }) {
  const width = Math.max(0, Math.min(100, Math.round(subject.average_score)));
  return (
    <article className="rounded-lg border border-[#15213d]/10 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="font-display text-base font-semibold">{subject.subject}</p><p className="mt-1 text-[0.68rem] text-[#4f586c]">Y{subject.current_year} baseline · working at Y{subject.working_year} · {subject.sampled_objectives}/{subject.objective_count} sampled</p></div>
        <span className="rounded-full bg-[#f7f0df] px-2 py-1 text-[0.68rem] font-semibold">{labelProgress(subject.status)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#15213d]/8" role="progressbar" aria-label={`${subject.subject} average evidence`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}><div className={`h-full rounded-full ${subject.stretch_allowed ? "bg-[#9d82ff]" : "bg-[#55cbd3]"}`} style={{ width: `${width}%` }} /></div><span className="w-10 text-right text-[0.68rem] font-semibold">{width}%</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${subject.subject} year route status`}>{subject.years.map((year) => <span key={year.year} className={`rounded-full px-2 py-1 text-[0.64rem] font-semibold ${progressColour(year.status)}`}>Y{year.year}: {labelProgress(year.status)}</span>)}</div>
    </article>
  );
}

function TopicList({ title, topics, tone, empty }: { title: string; topics: ProgressTopic[]; tone: "practice" | "strength"; empty: string }) {
  return <div className="rounded-lg border border-[#15213d]/10 bg-white p-3"><p className="font-display text-sm font-semibold">{title}</p>{topics.length ? <ul className="mt-2 grid gap-1.5">{topics.map((topic) => <li key={topic.objective_id} className="flex gap-2 leading-5"><span className={tone === "strength" ? "text-[#2c9b63]" : "text-[#d97919]"} aria-hidden="true">{tone === "strength" ? "✓" : "•"}</span><span>{topic.topic || topic.statement}<span className="block text-[0.66rem] text-[#596275]">Y{topic.year} · {topic.score}% evidence</span></span></li>)}</ul> : <p className="mt-2 leading-5 text-[#596275]">{empty}</p>}</div>;
}

function labelProgress(status: string) {
  if (status === "ahead") return "Ahead";
  if (status === "secure") return "Secure";
  if (status === "on_track") return "On track";
  if (status === "needs_practice") return "Practise";
  return "Not sampled";
}

function progressColour(status: string) {
  if (status === "ahead") return "bg-[#e7dcff] text-[#5035a1]";
  if (status === "secure") return "bg-[#dff7e5] text-[#215d26]";
  if (status === "on_track") return "bg-[#d9f7fa] text-[#16616a]";
  if (status === "needs_practice") return "bg-[#fff0c9] text-[#6a4a00]";
  return "bg-[#15213d]/8 text-[#4f586c]";
}
