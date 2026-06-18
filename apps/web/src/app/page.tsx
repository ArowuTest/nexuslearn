import Link from "next/link";
import type { CSSProperties } from "react";
import Dino from "@/components/Dino";
import { DEFAULT_STUDENT_ID, getCurriculumMap, getNextActivity, getRuntimeFlags, getWorlds } from "@/lib/api";

const SUBJECT_ACCENTS: Record<string, string> = {
  Mathematics: "#55cbd3",
  English: "#f7a6d8",
  Science: "#8be28f",
  Geography: "#74a7ff",
  History: "#ffbf45",
};

function NexusMap({
  worlds,
  activeKey,
}: {
  worlds: NonNullable<Awaited<ReturnType<typeof getWorlds>>>;
  activeKey?: string;
}) {
  const visible = worlds.filter((world) => world.year_group).slice(0, 7);
  return (
    <div className="relative min-h-[460px] overflow-hidden rounded-lg border border-white/12 bg-[#121a35] shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 bg-[#121a35]" />
      <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[#1f6d66]" />
      <div className="absolute inset-x-0 bottom-[34%] h-28 bg-[#2d8a6c]" style={{ clipPath: "polygon(0 72%, 12% 42%, 24% 58%, 38% 28%, 52% 60%, 68% 22%, 82% 54%, 100% 34%, 100% 100%, 0 100%)" }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 460" aria-hidden>
        <path d="M70 355 C152 255, 238 378, 306 260 C382 126, 468 218, 548 86" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="8" strokeLinecap="round" strokeDasharray="10 18" />
        <path className="anim-scan-line" d="M70 355 C152 255, 238 378, 306 260 C382 126, 468 218, 548 86" fill="none" stroke="rgba(255,255,255,0.66)" strokeWidth="4" strokeLinecap="round" />
      </svg>

      {visible.map((world, index) => {
        const positions = [
          [13, 76],
          [24, 50],
          [40, 73],
          [51, 48],
          [64, 30],
          [76, 43],
          [88, 18],
        ];
        const [left, top] = positions[index] ?? [20 + index * 10, 50];
        const accent = String(world.config?.accent || "#ffbf45");
        const active = world.key === activeKey;
        return (
          <div
            key={world.key}
            className={`absolute grid h-24 w-24 place-items-center rounded-lg border text-center shadow-[0_18px_38px_rgba(0,0,0,0.22)] ${active ? "anim-glow border-white bg-white text-[#162244]" : "border-white/30 bg-white/16 text-white backdrop-blur"}`}
            style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="absolute inset-x-3 top-3 h-2 rounded-full" style={{ backgroundColor: accent }} />
            <div className="relative px-2">
              <p className="font-display text-xs font-semibold">Y{world.year_group}</p>
              <p className="mx-auto mt-1 max-w-[74px] text-[11px] font-semibold leading-3">{world.name}</p>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-5 left-5 max-w-[250px] rounded-lg bg-white p-4 text-[#17233f] shadow-card">
        <p className="font-display text-sm font-semibold">Living learning map</p>
        <p className="mt-1 text-xs leading-5 text-[#17233f]/66">Realms unlock from configured curriculum and mastery evidence.</p>
      </div>
      <div className="absolute bottom-0 right-4">
        <Dino mood="celebrate" size={118} />
      </div>
    </div>
  );
}

export default async function Home() {
  const [worlds, curriculumMap, runtimeFlags] = await Promise.all([
    getWorlds(),
    getCurriculumMap(),
    getRuntimeFlags(),
  ]);
  const flags = runtimeFlags?.flags ?? {};
  const childPlayEnabled = flags.child_play_enabled !== false;
  const accessRequestsEnabled = flags.public_access_requests !== false;
  const familySignupEnabled = flags.public_family_signup !== false;
  const schoolWorkspaceEnabled = flags.public_school_workspace !== false;
  const publicDemoLearnerEnabled = flags.public_demo_learner_enabled === true && Boolean(DEFAULT_STUDENT_ID);
  const nextActivity = publicDemoLearnerEnabled ? await getNextActivity(DEFAULT_STUDENT_ID) : null;
  const configuredWorlds = worlds ?? [];
  const activeWorld = configuredWorlds.find((world) => world.key === nextActivity?.world_key) ?? configuredWorlds[0];
  const activeAccent = String(activeWorld?.config?.accent || "#ffbf45");
  const activeFocus = String(activeWorld?.config?.focus || activeWorld?.theme || "Configured learning mission");
  const activeTitle = activeWorld?.name ?? "Nexusverse";
  const years = curriculumMap?.years ?? [];
  const subjects = curriculumMap?.subjects ?? [];
  const coveredYears = years.filter((year) => year.total > 0).length;

  return (
    <main className="bg-[#f7f0df] text-[#162244]">
      <section className="bg-[#121a35] text-white">
        <div className="mx-auto max-w-7xl px-5 py-5">
          <nav className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-display text-xl font-semibold">NexusLearn</Link>
            <div className="flex flex-wrap gap-2 text-sm">
              {childPlayEnabled && <Link href="/play" className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Play</Link>}
              {accessRequestsEnabled && <Link href="/request-access" className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Access</Link>}
              {familySignupEnabled && <Link href="/family" className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Family</Link>}
              {schoolWorkspaceEnabled && <Link href="/school-admin" className="rounded-lg bg-white/10 px-4 py-2 font-semibold">School</Link>}
            </div>
          </nav>

          <div className="grid min-h-[calc(100vh-92px)] items-center gap-10 py-10 lg:grid-cols-[0.88fr_1.12fr]">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">UK Years 1-7 learning universe</p>
              <h1 className="font-display mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] md:text-7xl">NexusLearn</h1>
              <p className="mt-5 max-w-2xl text-xl leading-8 text-white/80">
                Animated missions, adaptive support and evidence-rich curriculum pathways for children, families and schools.
              </p>
              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
                {childPlayEnabled && (
                  <Link href="/play" className="btn-pop bg-[#ffbf45] px-5 py-4 text-[#17233f]">
                    Enter the Nexusverse
                  </Link>
                )}
                {accessRequestsEnabled && (
                  <Link href="/request-access" className="btn-pop bg-[#55cbd3] px-5 py-4 text-[#17233f]">
                    Request access
                  </Link>
                )}
                {familySignupEnabled && (
                  <Link href="/family" className="btn-pop bg-[#f7a6d8] px-5 py-4 text-[#17233f]">
                    Family signup
                  </Link>
                )}
                {schoolWorkspaceEnabled && (
                  <Link href="/school-admin" className="btn-pop border border-white/18 bg-white/12 px-5 py-4 text-white">
                    School workspace
                  </Link>
                )}
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  ["Years", `${coveredYears}/7`],
                  ["Objectives", String(curriculumMap?.total ?? 0)],
                  ["Subjects", String(subjects.length)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/12 bg-white/10 p-4">
                    <p className="font-display text-3xl font-semibold text-[#ffdf8a]">{value}</p>
                    <p className="mt-1 text-sm text-white/62">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <NexusMap worlds={configuredWorlds} activeKey={activeWorld?.key} />
          </div>
        </div>
      </section>

      <section className="border-y border-[#162244]/10 bg-white py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Access-controlled learning</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">{publicDemoLearnerEnabled ? activeTitle : "Learning opens through a child profile."}</h2>
            <p className="mt-4 text-base leading-7 text-[#162244]/68">
              {publicDemoLearnerEnabled ? activeFocus : "Schools, parents and tutoring teams issue child-safe access. The public site shows the universe and pathways, not an unstructured question bank."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <article className="rounded-lg border border-[#162244]/10 bg-[#f7f0df] p-5">
              <p className="font-display text-sm uppercase tracking-[0.16em]" style={{ color: activeAccent }}>{publicDemoLearnerEnabled ? "Demo route" : "Child route"}</p>
              <h3 className="font-display mt-3 text-2xl font-semibold">{publicDemoLearnerEnabled ? (nextActivity?.world ?? "No configured route yet") : "Pupil login, family profile or school card"}</h3>
              <p className="mt-3 text-sm leading-6 text-[#162244]/68">
                {publicDemoLearnerEnabled ? (nextActivity?.explanation ?? "Publish a learner activity to make this route live.") : "Children do not need email accounts. They enter with issued IDs, login codes, picture passwords or QR cards."}
              </p>
            </article>
            <article className="rounded-lg border border-[#162244]/10 bg-white p-5">
              <p className="font-display text-sm uppercase tracking-[0.16em] text-[#7357c9]">Runtime adaptation</p>
              <h3 className="font-display mt-3 text-2xl font-semibold">{nextActivity?.runtime_adaptations?.session_length ?? "profile-led"} session</h3>
              <p className="mt-3 text-sm leading-6 text-[#162244]/68">
                {nextActivity?.runtime_adaptations?.reasons?.[0] ?? "SEND, sensory, audio, reading, confidence and attention preferences tune the child runtime after profile setup."}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-8 lg:grid-cols-[0.64fr_1.36fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Curriculum map</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">Year, subject and strand coverage.</h2>
            <p className="mt-4 text-base leading-7 text-[#162244]/66">
              Starter coverage is now organised as a real curriculum system: objective packs, teaching steps, misconceptions and evidence rules.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-7">
            {years.map((year) => (
              <div key={year.year} className="rounded-lg border border-[#162244]/10 bg-white p-4 shadow-card">
                <p className="font-display text-lg font-semibold">Y{year.year}</p>
                <p className="mt-1 text-3xl font-semibold" style={{ color: year.total ? "#7357c9" : "#9c978b" }}>{year.total}</p>
                <p className="text-xs text-[#162244]/52">objectives</p>
                <div className="mt-3 space-y-1">
                  {year.subjects.slice(0, 3).map((subject) => (
                    <p key={subject.name} className="truncate text-xs text-[#162244]/66">{subject.name}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#17233f] py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.64fr_1.36fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Subject pathways</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">Structured learning, not a single quiz game.</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {subjects.map((subject) => {
              const accent = SUBJECT_ACCENTS[subject.name] ?? "#7357c9";
              return (
                <article key={subject.name} className="rounded-lg border border-white/10 bg-white/10 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: accent }} />
                      <h3 className="font-display text-2xl font-semibold">{subject.name}</h3>
                    </div>
                    <p className="text-sm font-semibold text-white/58">{subject.total}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {subject.strands.map((strand) => (
                      <span key={strand.name} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/70">
                        {strand.name}: {strand.objectives}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-4 md:grid-cols-4">
          {configuredWorlds.filter((world) => world.year_group).slice(0, 7).map((world) => {
            const accent = String(world.config?.accent || "#ffbf45");
            return (
              <article key={world.key} className="min-h-[188px] rounded-lg bg-white p-5 shadow-card">
                <div className="grid h-14 w-14 place-items-center rounded-lg font-display font-semibold text-[#162244]" style={{ backgroundColor: accent } as CSSProperties}>
                  Y{world.year_group}
                </div>
                <h3 className="font-display mt-5 text-2xl font-semibold">{world.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#162244]/62">{String(world.config?.focus || world.theme)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
