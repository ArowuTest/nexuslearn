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
    <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/14 bg-[#121a35] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#18275a_0%,#133d4a_48%,#f4dfb2_48%,#2b8b67_58%,#246a69_100%)]" />
      <div className="absolute inset-x-0 top-[36%] h-28 bg-[#1d6f69]" style={{ clipPath: "polygon(0 72%, 12% 42%, 24% 58%, 38% 28%, 52% 60%, 68% 22%, 82% 54%, 100% 34%, 100% 100%, 0 100%)" }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 520" aria-hidden>
        <path d="M76 398 C160 292, 238 438, 304 310 C376 172, 474 264, 548 116" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="8" strokeLinecap="round" strokeDasharray="10 18" />
        <path className="anim-scan-line" d="M76 398 C160 292, 238 438, 304 310 C376 172, 474 264, 548 116" fill="none" stroke="rgba(255,255,255,0.66)" strokeWidth="4" strokeLinecap="round" />
      </svg>

      {visible.map((world, index) => {
        const positions = [
          [13, 72],
          [24, 48],
          [40, 72],
          [50, 48],
          [63, 30],
          [75, 44],
          [86, 20],
        ];
        const [left, top] = positions[index] ?? [20 + index * 10, 50];
        const accent = String(world.config?.accent || "#ffbf45");
        const active = world.key === activeKey;
        return (
          <div
            key={world.key}
            className={`absolute grid h-24 w-24 place-items-center rounded-full border text-center shadow-[0_18px_38px_rgba(0,0,0,0.22)] ${active ? "anim-glow border-white bg-white text-[#162244]" : "border-white/30 bg-white/18 text-white backdrop-blur"}`}
            style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="absolute inset-2 rounded-full opacity-70" style={{ backgroundColor: accent }} />
            <div className="relative">
              <p className="font-display text-xs font-semibold">Y{world.year_group}</p>
              <p className="mx-auto mt-1 max-w-[74px] text-[11px] font-semibold leading-3">{world.name}</p>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-7 left-7 max-w-[250px] rounded-lg bg-white p-4 text-[#17233f] shadow-card">
        <p className="font-display text-sm font-semibold">Living learning map</p>
        <p className="mt-1 text-xs leading-5 text-[#17233f]/66">Realms unlock from configured curriculum, not page copy.</p>
      </div>
      <div className="absolute bottom-2 right-5">
        <Dino mood="celebrate" size={128} />
      </div>
    </div>
  );
}

export default async function Home() {
  const [worlds, nextActivity, curriculumMap, runtimeFlags] = await Promise.all([
    getWorlds(),
    getNextActivity(DEFAULT_STUDENT_ID),
    getCurriculumMap(),
    getRuntimeFlags(),
  ]);
  const flags = runtimeFlags?.flags ?? {};
  const childPlayEnabled = flags.child_play_enabled !== false;
  const accessRequestsEnabled = flags.public_access_requests !== false;
  const familySignupEnabled = flags.public_family_signup !== false;
  const schoolWorkspaceEnabled = flags.public_school_workspace !== false;
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
      <section className="relative overflow-hidden bg-[#121a35] text-white">
        <div className="mx-auto grid min-h-[92vh] max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="relative z-10">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">UK Years 1-7 curriculum universe</p>
            <h1 className="font-display mt-5 max-w-3xl text-5xl font-semibold leading-[0.96] md:text-7xl">
              NexusLearn
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-white/80">
              Children travel through age-tuned worlds, complete animated missions and grow a personal learning map while every activity stays tied to curriculum objectives, prerequisites and misconceptions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {childPlayEnabled && (
                <Link href="/play" className="btn-pop rounded-lg bg-[#ffbf45] px-6 py-4 text-[#17233f]">
                  Enter the Nexusverse
                </Link>
              )}
              {accessRequestsEnabled && (
                <Link href="/request-access" className="btn-pop rounded-lg bg-[#55cbd3] px-6 py-4 text-[#17233f]">
                  Request access
                </Link>
              )}
              {familySignupEnabled && (
                <Link href="/family" className="btn-pop rounded-lg bg-[#f7a6d8] px-6 py-4 text-[#17233f]">
                  Family sign up
                </Link>
              )}
              {schoolWorkspaceEnabled && (
                <Link href="/school-admin" className="btn-pop rounded-lg border border-white/18 bg-white/12 px-6 py-4 text-white backdrop-blur">
                  School workspace
                </Link>
              )}
              <Link href="/parents" className="btn-pop rounded-lg border border-white/18 bg-white/12 px-6 py-4 text-white backdrop-blur">
                View evidence dashboard
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
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
      </section>

      <section className="border-y border-[#162244]/10 bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Live curriculum map</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">Categorised by year, subject and strand.</h2>
            <p className="mt-4 text-base leading-7 text-[#162244]/66">
              This is still starter coverage, but it now exposes the structure we need for a full Year 1-7 build instead of pretending a multiplication slice is the whole product.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-7">
            {years.map((year) => (
              <div key={year.year} className="rounded-lg border border-[#162244]/10 bg-[#f7f0df] p-4">
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

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Subject pathways</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">Not one game. A connected learning system.</h2>
          </div>
          <div className="grid gap-3">
            {subjects.map((subject) => {
              const accent = SUBJECT_ACCENTS[subject.name] ?? "#7357c9";
              return (
                <article key={subject.name} className="rounded-lg bg-white p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: accent }} />
                      <h3 className="font-display text-2xl font-semibold">{subject.name}</h3>
                    </div>
                    <p className="text-sm font-semibold text-[#162244]/58">{subject.total} objectives</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {subject.strands.map((strand) => (
                      <span key={strand.name} className="rounded-lg bg-[#f7f0df] px-3 py-2 text-xs font-semibold text-[#162244]/70">
                        {strand.name}: {strand.objectives}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
            {subjects.length === 0 && (
              <article className="rounded-lg bg-white p-5 shadow-card">
                <h3 className="font-display text-2xl font-semibold">Curriculum not configured yet</h3>
                <p className="mt-2 text-sm leading-6 text-[#162244]/62">Publish objectives in admin to populate this pathway.</p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#17233f] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Current configured mission</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">{activeTitle}</h2>
            <p className="mt-4 text-lg leading-8 text-white/74">{activeFocus}</p>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/10 p-6">
            <p className="font-display text-sm uppercase tracking-[0.16em]" style={{ color: activeAccent }}>Next learner route</p>
            <h3 className="font-display mt-3 text-3xl font-semibold">{nextActivity?.world ?? "No configured route yet"}</h3>
            <p className="mt-3 leading-7 text-white/70">{nextActivity?.explanation ?? "Publish a learner activity to make this route live."}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(nextActivity?.recommended_actions ?? []).slice(0, 3).map((action) => (
                <span key={action} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/72">{action}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-4 md:grid-cols-4">
          {configuredWorlds.filter((world) => world.year_group).slice(0, 7).map((world, index) => {
            const accent = String(world.config?.accent || "#ffbf45");
            return (
              <article key={world.key} className="min-h-[190px] rounded-lg bg-white p-5 shadow-card">
                <div
                  className="grid h-14 w-14 place-items-center rounded-lg font-display font-semibold text-[#162244]"
                  style={{ backgroundColor: accent, transform: `rotate(${(index % 3) * 4 - 4}deg)` } as CSSProperties}
                >
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
