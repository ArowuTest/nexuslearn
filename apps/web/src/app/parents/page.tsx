import Link from "next/link";

/* Slice 1: dashboard shell with representative data so parents/schools can
   see the reporting vision. Slice 2 wires this to live mastery data. */

const SUBJECTS = [
  { name: "Maths", mastery: 72, color: "bg-sky", note: "Times tables improving fast — 6× and 8× now secure" },
  { name: "Reading", mastery: 64, color: "bg-leaf", note: "Inference questions need practice; fluency is strong" },
  { name: "Writing", mastery: 51, color: "bg-coral", note: "Working on expanded noun phrases this week" },
  { name: "Science", mastery: 58, color: "bg-grape", note: "States of matter introduced — revisit on Friday" },
];

const OBJECTIVES = [
  { label: "Recall multiplication facts to 12 × 12", band: "Nearly Secure", pct: 76 },
  { label: "Area of rectangles by counting squares", band: "Developing", pct: 48 },
  { label: "Use apostrophes for possession", band: "Expected", pct: 82 },
  { label: "Read and interpret bar charts", band: "Secure", pct: 93 },
];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-ink/8">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%`, transition: "width 1s ease" }}
      />
    </div>
  );
}

export default function Parents() {
  return (
    <main className="min-h-screen bg-cream px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold">Alex&apos;s progress</h1>
            <p className="text-ink/60">Year 4 · Dino-Craft world · This week</p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-2.5 text-sm shadow-card">
            ← Home
          </Link>
        </div>

        {/* headline cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { v: "4 days", l: "Practised this week", e: "🔥" },
            { v: "38 min", l: "Average session", e: "⏱️" },
            { v: "+12%", l: "Times-table fluency", e: "📈" },
          ].map((c) => (
            <div key={c.l} className="rounded-blob bg-white p-6 shadow-card">
              <div className="text-2xl">{c.e}</div>
              <p className="font-display mt-1 text-2xl font-semibold">{c.v}</p>
              <p className="text-sm text-ink/60">{c.l}</p>
            </div>
          ))}
        </div>

        {/* subjects */}
        <h2 className="font-display mt-10 text-xl font-semibold">Progress by subject</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {SUBJECTS.map((s) => (
            <div key={s.name} className="rounded-blob bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold">{s.name}</p>
                <p className="font-display text-ink/70">{s.mastery}%</p>
              </div>
              <div className="mt-3">
                <Bar pct={s.mastery} color={s.color} />
              </div>
              <p className="mt-3 text-sm text-ink/60">{s.note}</p>
            </div>
          ))}
        </div>

        {/* objectives */}
        <h2 className="font-display mt-10 text-xl font-semibold">Curriculum objectives</h2>
        <div className="mt-4 overflow-hidden rounded-blob bg-white shadow-card">
          {OBJECTIVES.map((o, i) => (
            <div
              key={o.label}
              className={`flex items-center gap-4 p-5 ${i > 0 ? "border-t border-ink/5" : ""}`}
            >
              <div className="flex-1">
                <p className="font-medium">{o.label}</p>
                <p className="text-xs text-ink/50">{o.band}</p>
              </div>
              <div className="w-36">
                <Bar
                  pct={o.pct}
                  color={o.pct >= 80 ? "bg-leaf" : o.pct >= 60 ? "bg-sky" : "bg-sun"}
                />
              </div>
            </div>
          ))}
        </div>

        {/* recommendation */}
        <div className="mt-8 rounded-blob bg-gradient-to-br from-grape to-sky p-7 text-white shadow-card">
          <h3 className="font-display text-lg font-semibold">💡 This week&apos;s home tip</h3>
          <p className="mt-2 text-white/90">
            Alex hesitates on 7×8 and 6×8. Try a 5-minute &quot;dino egg
            countdown&quot; at breakfast: you say the question, Alex powers the
            answer. NexusLearn will bring these facts back tomorrow, in 3 days
            and in 7 days to lock them in.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-ink/40">
          Demo data — the live dashboard updates as your child plays.
        </p>
      </div>
    </main>
  );
}
