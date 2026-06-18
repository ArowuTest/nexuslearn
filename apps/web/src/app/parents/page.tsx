import Link from "next/link";
import { DEFAULT_STUDENT_ID, getEvidenceSummary, getMastery, getNextActivity, getObjectives, getRecentAttempts, getRuntimeFlags, getStudentProfile } from "@/lib/api";

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-ink/8">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function Parents() {
  const runtimeFlags = await getRuntimeFlags();
  const publicDemoLearnerEnabled = runtimeFlags?.flags?.public_demo_learner_enabled === true && Boolean(DEFAULT_STUDENT_ID);
  if (!publicDemoLearnerEnabled) {
    return (
      <main className="min-h-screen bg-[#f7f0df] px-6 py-10 text-[#162244]">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <section>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Parent evidence</p>
            <h1 className="font-display mt-3 text-5xl font-semibold leading-tight">Progress opens from a family or school profile.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#162244]/68">
              NexusLearn does not expose a public learner dashboard by default. Parents can create a family account, schools can issue child access, and the evidence view then follows the right child profile.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/family" className="btn-pop bg-[#ffbf45] px-5 py-4 text-[#162244]">Family workspace</Link>
              <Link href="/request-access" className="btn-pop bg-[#55cbd3] px-5 py-4 text-[#162244]">Request access</Link>
              <Link href="/" className="btn-pop bg-white px-5 py-4 text-[#162244] shadow-card">Home</Link>
            </div>
          </section>
          <section className="overflow-hidden rounded-lg bg-white shadow-[0_26px_80px_rgba(22,34,68,0.16)]">
            <div className="border-b border-[#162244]/10 bg-[#17233f] p-6 text-white">
              <p className="font-display text-sm uppercase tracking-[0.16em] text-[#ffbf45]">Evidence model</p>
              <h2 className="font-display mt-2 text-3xl font-semibold">What this page will show after access</h2>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              {[
                ["Objective mastery", "Scores and bands tied to configured curriculum objectives."],
                ["Retention queue", "Spaced reviews, due items and repaired misconceptions."],
                ["SEND-aware next step", "Plain-English explanation of why the next activity was chosen."],
                ["Recent attempts", "Evidence from real missions, not a loose question list."],
              ].map(([title, body]) => (
                <article key={title} className="border-b border-r border-[#162244]/10 p-6">
                  <h3 className="font-display text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#162244]/62">{body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  const [objectives, mastery, nextActivity, profile, summary] = await Promise.all([
    getObjectives(),
    getMastery(DEFAULT_STUDENT_ID),
    getNextActivity(DEFAULT_STUDENT_ID),
    getStudentProfile(DEFAULT_STUDENT_ID),
    getEvidenceSummary(DEFAULT_STUDENT_ID),
  ]);
  const recentAttempts = await getRecentAttempts(DEFAULT_STUDENT_ID);
  const learnerName = profile?.display_name ?? "Learner";

  const objectiveRows = (mastery ?? []).map((m) => {
          const objective = (objectives ?? []).find((o) => o.id === m.objective_id);
          return {
            label: objective?.statement ?? m.objective_id,
            band: m.band,
            pct: m.score,
            next: m.next_review_due === "after prerequisite repair" ? m.last_signal : `Review due ${m.next_review_due}`,
          };
        });

  const subjectRows = buildSubjectRows(objectives ?? [], mastery ?? []);

  const signals = [
    { value: String(summary?.attempts_7_days ?? 0), label: "Attempts this week" },
    { value: `${summary?.accuracy_7_days ?? 0}%`, label: "Accuracy this week" },
    { value: String(summary?.open_reviews ?? 0), label: "Open reviews" },
    { value: String(summary?.misconceptions_repaired ?? 0), label: "Repaired signals" },
  ];

  const adaptiveExplanation =
    nextActivity?.explanation ??
    "No configured adaptive recommendation is available yet for this learner.";

  const companionPrompt =
    nextActivity?.companion_prompt ??
    "Once the learner completes configured activities, this panel will show a suggested adult prompt.";

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
          {signals.map((signal) => (
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
              {subjectRows.length ? subjectRows.map((subject) => (
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
              )) : (
                <EmptyState title="No subject evidence yet" body="Subject progress appears after the learner completes configured activities." />
              )}
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
          {objectiveRows.length ? objectiveRows.map((objective, i) => (
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
          )) : <EmptyState title="No objective evidence yet" body="Mastery rows will appear after attempts are stored against configured curriculum objectives." />}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="border-b border-ink/8 p-6">
            <h2 className="font-display text-2xl font-semibold">Recent learning evidence</h2>
            <p className="text-sm text-ink/56">Real attempts from the learning engine, translated into useful signals.</p>
          </div>
          {recentAttempts?.length ? recentAttempts.slice(0, 5).map((attempt, i) => {
            const objective = objectives?.find((o) => o.id === attempt.objective_id);
            return (
              <div key={`${attempt.question_id}-${i}`} className={`grid gap-4 p-6 md:grid-cols-[120px_1fr_170px] ${i > 0 ? "border-t border-ink/8" : ""}`}>
                <div>
                  <p className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${attempt.correct ? "bg-[#8be28f]/30 text-[#215d26]" : "bg-[#ffbf45]/30 text-[#6a4a00]"}`}>
                    {attempt.correct ? "Secured" : "Repair"}
                  </p>
                  <p className="mt-2 text-xs text-ink/45">{new Date(attempt.attempted_at).toLocaleDateString("en-GB")}</p>
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
          }) : <EmptyState title="No recent attempts yet" body="This section will fill with real learning evidence once the learner completes a mission." />}
        </section>
      </div>
    </main>
  );
}

function buildSubjectRows(objectives: NonNullable<Awaited<ReturnType<typeof getObjectives>>>, mastery: NonNullable<Awaited<ReturnType<typeof getMastery>>>) {
  const grouped = new Map<string, { total: number; count: number; lastSignal: string }>();
  for (const item of mastery) {
    const objective = objectives.find((o) => o.id === item.objective_id);
    const subject = objective?.subject ?? "Unassigned";
    const current = grouped.get(subject) ?? { total: 0, count: 0, lastSignal: "" };
    current.total += item.score;
    current.count += 1;
    current.lastSignal = item.last_signal || current.lastSignal;
    grouped.set(subject, current);
  }
  const colors = ["bg-[#55cbd3]", "bg-[#8be28f]", "bg-[#ff7b73]", "bg-[#9d82ff]"];
  return Array.from(grouped.entries()).map(([name, value], index) => ({
    name,
    mastery: Math.round(value.total / Math.max(1, value.count)),
    note: value.lastSignal || "Evidence is being collected.",
    color: colors[index % colors.length],
  }));
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 text-sm leading-6 text-ink/58">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}
