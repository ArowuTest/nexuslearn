import Link from "next/link";
import { DEFAULT_STUDENT_ID, getMastery, getNextActivity, getObjectives, getRecentAttempts, getStudentProfile } from "@/lib/api";

const SUBJECTS = [
  {
    name: "Maths",
    mastery: 72,
    note: "Multiplication recall is improving. Area questions still trigger array scaffolds.",
    color: "bg-[#55cbd3]",
  },
  {
    name: "Reading",
    mastery: 64,
    note: "Retrieval is strong. Inference needs shorter, repeated practice.",
    color: "bg-[#8be28f]",
  },
  {
    name: "Writing",
    mastery: 51,
    note: "Sentence expansion and punctuation are the next focus.",
    color: "bg-[#ff7b73]",
  },
  {
    name: "Science",
    mastery: 58,
    note: "States of matter introduced. A review mission is due on Friday.",
    color: "bg-[#9d82ff]",
  },
];

const FALLBACK_OBJECTIVES = [
  {
    label: "Recall multiplication and division facts up to 12 x 12",
    band: "Nearly secure",
    pct: 76,
    next: "Review 6 x 8 and 7 x 8 tomorrow",
  },
  {
    label: "Find area of rectangles using arrays and counting squares",
    band: "Developing",
    pct: 48,
    next: "Route through array builder before formal area",
  },
  {
    label: "Use apostrophes for possession",
    band: "Expected",
    pct: 82,
    next: "Mix singular and plural possession examples",
  },
  {
    label: "Read and interpret bar charts",
    band: "Secure",
    pct: 93,
    next: "Use data in a science investigation",
  },
];

const SIGNALS = [
  { value: "4 days", label: "Practised this week" },
  { value: "31 min", label: "Average focused session" },
  { value: "+12%", label: "Times-table fluency" },
  { value: "3", label: "Misconceptions repaired" },
];

const FALLBACK_ATTEMPTS = [
  {
    student_id: "alex-demo",
    objective_id: "ma-y4-number-multiplication-12x12",
    question_id: "demo-7x8",
    correct: false,
    response_ms: 9400,
    hint_used: true,
    mastery_delta: -2,
    explanation: "Incorrect recall suggests this fact should be repaired with a visual array before returning to timed practice.",
    attempted_at: "demo",
    animation_hook: "array-scaffold",
  },
  {
    student_id: "alex-demo",
    objective_id: "ma-y4-number-multiplication-12x12",
    question_id: "demo-6x8",
    correct: true,
    response_ms: 4100,
    hint_used: false,
    mastery_delta: 10,
    explanation: "Correct recall increases mastery; the fact will return through spaced review so it sticks over time.",
    attempted_at: "demo",
    animation_hook: "machine-charge",
  },
];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-ink/8">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function Parents() {
  const [objectives, mastery, nextActivity, profile] = await Promise.all([
    getObjectives(),
    getMastery(DEFAULT_STUDENT_ID),
    getNextActivity(DEFAULT_STUDENT_ID),
    getStudentProfile(DEFAULT_STUDENT_ID),
  ]);
  const recentAttempts = await getRecentAttempts(DEFAULT_STUDENT_ID);
  const learnerName = profile?.display_name ?? "Alex";

  const objectiveRows =
    objectives && mastery
      ? mastery.map((m) => {
          const objective = objectives.find((o) => o.id === m.objective_id);
          return {
            label: objective?.statement ?? m.objective_id,
            band: m.band,
            pct: m.score,
            next: m.next_review_due === "after prerequisite repair" ? m.last_signal : `Review due ${m.next_review_due}`,
          };
        })
      : FALLBACK_OBJECTIVES;

  const adaptiveExplanation =
    nextActivity?.explanation ??
    `${learnerName} should practise mixed 6, 7 and 8 times tables using arrays first, then return to area of rectangles. The system is not lowering expectations; it is repairing the missing prerequisite.`;

  const companionPrompt =
    nextActivity?.companion_prompt ??
    `Five-minute breakfast recall: ask 6 x 8, 7 x 8 and 8 x 7, then let ${learnerName} explain one answer using groups.`;

  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-grape">Parent and school evidence view</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">{learnerName}&apos;s learning picture</h1>
            <p className="mt-2 max-w-2xl text-ink/62">
              Configured reporting direction: objective progress, prerequisites, misconceptions,
              retention and suggested next steps in plain English.
            </p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-3 text-sm shadow-card">
            Home
          </Link>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {SIGNALS.map((signal) => (
            <article key={signal.label} className="rounded-2xl bg-white p-6 shadow-card">
              <p className="font-display text-3xl font-semibold">{signal.value}</p>
              <p className="mt-1 text-sm text-ink/58">{signal.label}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.72fr]">
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold">Progress by subject</h2>
                <p className="text-sm text-ink/56">Designed for scanning, not vanity scoring.</p>
              </div>
              <span className="rounded-full bg-[#ffbf45]/25 px-4 py-2 text-sm font-semibold text-[#6a4a00]">
                This week
              </span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {SUBJECTS.map((subject) => (
                <article key={subject.name} className="rounded-2xl bg-cream p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold">{subject.name}</h3>
                    <p className="font-display text-lg font-semibold">{subject.mastery}%</p>
                  </div>
                  <div className="mt-3">
                    <Bar pct={subject.mastery} color={subject.color} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink/62">{subject.note}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl bg-[#17233f] p-6 text-white shadow-card">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Adaptive recommendation</p>
            <h2 className="font-display mt-3 text-2xl font-semibold">Next best learning move</h2>
            <p className="mt-4 leading-7 text-white/74">
              {adaptiveExplanation}
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-4">
              <p className="font-display font-semibold">Companion prompt</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {companionPrompt}
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="border-b border-ink/8 p-6">
            <h2 className="font-display text-2xl font-semibold">Objective evidence</h2>
            <p className="text-sm text-ink/56">This is the reporting level schools will care about.</p>
          </div>
          {objectiveRows.map((objective, i) => (
            <div key={objective.label} className={`grid gap-4 p-6 md:grid-cols-[1fr_160px_1fr] ${i > 0 ? "border-t border-ink/8" : ""}`}>
              <div>
                <p className="font-semibold">{objective.label}</p>
                <p className="mt-1 text-sm text-ink/52">{objective.band}</p>
              </div>
              <div>
                <Bar pct={objective.pct} color={objective.pct >= 80 ? "bg-[#8be28f]" : objective.pct >= 60 ? "bg-[#55cbd3]" : "bg-[#ffbf45]"} />
                <p className="mt-1 text-right text-xs text-ink/48">{objective.pct}%</p>
              </div>
              <p className="text-sm leading-6 text-ink/60">{objective.next}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="border-b border-ink/8 p-6">
            <h2 className="font-display text-2xl font-semibold">Recent learning evidence</h2>
            <p className="text-sm text-ink/56">Real attempts from the learning engine, translated into useful signals.</p>
          </div>
          {(recentAttempts?.length ? recentAttempts : FALLBACK_ATTEMPTS).slice(0, 5).map((attempt, i) => {
            const objective = objectives?.find((o) => o.id === attempt.objective_id);
            return (
              <div key={`${attempt.question_id}-${i}`} className={`grid gap-4 p-6 md:grid-cols-[120px_1fr_170px] ${i > 0 ? "border-t border-ink/8" : ""}`}>
                <div>
                  <p className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${attempt.correct ? "bg-[#8be28f]/30 text-[#215d26]" : "bg-[#ffbf45]/30 text-[#6a4a00]"}`}>
                    {attempt.correct ? "Secured" : "Repair"}
                  </p>
                  <p className="mt-2 text-xs text-ink/45">{attempt.attempted_at === "demo" ? "Demo signal" : new Date(attempt.attempted_at).toLocaleDateString("en-GB")}</p>
                </div>
                <div>
                  <p className="font-semibold">{objective?.statement ?? attempt.objective_id}</p>
                  <p className="mt-1 text-sm leading-6 text-ink/60">{attempt.explanation}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-display text-lg font-semibold">{attempt.mastery_delta > 0 ? `+${attempt.mastery_delta}` : attempt.mastery_delta}</p>
                  <p className="text-xs text-ink/48">mastery signal</p>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
