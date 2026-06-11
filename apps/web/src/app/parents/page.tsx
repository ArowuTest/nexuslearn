import Link from "next/link";

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

const OBJECTIVES = [
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

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-ink/8">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Parents() {
  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-grape">Parent and school evidence view</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">Alex's learning picture</h1>
            <p className="mt-2 max-w-2xl text-ink/62">
              Demo data showing the reporting direction: objective progress, prerequisites,
              misconceptions, retention and suggested next steps in plain English.
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
              Alex should practise mixed 6, 7 and 8 times tables using arrays first, then return to
              area of rectangles. The system is not lowering expectations; it is repairing the missing
              prerequisite.
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-4">
              <p className="font-display font-semibold">Home activity</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Five-minute breakfast recall: ask 6 x 8, 7 x 8 and 8 x 7, then let Alex explain one
                answer using groups.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="border-b border-ink/8 p-6">
            <h2 className="font-display text-2xl font-semibold">Objective evidence</h2>
            <p className="text-sm text-ink/56">This is the reporting level schools will care about.</p>
          </div>
          {OBJECTIVES.map((objective, i) => (
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
      </div>
    </main>
  );
}
