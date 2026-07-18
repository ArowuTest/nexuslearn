import Link from "next/link";
import type { CSSProperties } from "react";
import ChildJourneyChrome, { ApiStateCard } from "@/components/ChildJourneyChrome";
import Dino from "@/components/Dino";
import { DEFAULT_STUDENT_ID, getNextActivity, getRuntimeFlags, getWorlds } from "@/lib/api";

const WORLD_SHAPES = ["seed", "story", "island", "machine", "orbit", "crest", "lab"] as const;
const MVP_SUBJECTS = [
  { name: "English", short: "Words & stories", accent: "#f7a6d8", icon: "✦" },
  { name: "Mathematics", short: "Patterns & problem solving", accent: "#55cbd3", icon: "＋" },
  { name: "Science", short: "Questions & discovery", accent: "#8be28f", icon: "◌" },
] as const;

export default async function PlayEntry() {
  const [worlds, runtimeFlags] = await Promise.all([
    getWorlds(),
    getRuntimeFlags(),
  ]);
  const flags = runtimeFlags?.flags ?? {};
  const childPlayEnabled = flags.child_play_enabled !== false;
  const showDemoBadges = flags.show_demo_badges !== false;
  const publicDemoLearnerEnabled = flags.public_demo_learner_enabled === true && Boolean(DEFAULT_STUDENT_ID);
  const visualPortalsEnabled = flags.child_visual_portals_enabled !== false;
  const ambientMotionEnabled = flags.child_world_ambient_motion_enabled !== false;
  const nextActivity = publicDemoLearnerEnabled ? await getNextActivity(DEFAULT_STUDENT_ID) : null;
  const nextDecisionFacts = nextActivity
    ? [
        ["Mode", nextActivity.assessment_mode.replaceAll("_", " ")],
        ["Difficulty", `${nextActivity.difficulty}/10`],
        ["Interaction", nextActivity.interaction],
        ["Support", nextActivity.scaffold ? "scaffolded" : "independent"],
      ]
    : [];
  const profiles = worlds?.length
    ? worlds.filter((world) => world.year_group).map((world) => ({
        name: String(world.config?.companion || world.name),
        year: `Year ${world.year_group}`,
        world: world.name,
        focus: String(world.config?.focus || world.theme),
        accent: String(world.config?.accent || "#ffbf45"),
        route: publicDemoLearnerEnabled
          ? (world.key === nextActivity?.world_key
              ? `/play/mission?studentId=${encodeURIComponent(DEFAULT_STUDENT_ID)}&activityId=${encodeURIComponent(nextActivity.activity_id)}&mode=${encodeURIComponent(nextActivity.assessment_mode)}`
              : `/play/mission?studentId=${encodeURIComponent(DEFAULT_STUDENT_ID)}&world=${encodeURIComponent(world.key)}`)
          : `/login?world=${encodeURIComponent(world.key)}`,
        live: publicDemoLearnerEnabled && world.key === nextActivity?.world_key,
        shape: WORLD_SHAPES[(Math.max(1, world.year_group) - 1) % WORLD_SHAPES.length],
      }))
    : [];
  const worldsAvailable = worlds !== null;
  const runtimeAvailable = runtimeFlags !== null;

  if (!childPlayEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#17233f] px-6 text-white">
        <section className="max-w-xl rounded-lg border border-white/10 bg-white/10 p-8 text-center backdrop-blur">
          <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Child entry paused</p>
          <h1 className="font-display mt-3 text-4xl font-semibold">The Nexusverse is being prepared.</h1>
          <p className="mt-4 leading-7 text-white/68">An admin has paused child entry while content or settings are being updated.</p>
          <Link href="/" className="btn-pop mt-6 inline-flex bg-[#ffbf45] px-5 py-3 text-sm text-[#17233f]">
            Back home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={`play-entry min-h-screen overflow-hidden bg-[#111a33] text-white ${ambientMotionEnabled ? "" : "reduced-motion"}`}>
      {visualPortalsEnabled && <div className="play-entry__aurora" aria-hidden="true" />}
      {visualPortalsEnabled && <div className="play-entry__grid" aria-hidden="true" />}
      <div className="relative mx-auto max-w-7xl px-5 py-5">
        <ChildJourneyChrome
          active="route"
          context="Choose today’s route across English, Mathematics and Science"
          backHref="/"
          backLabel="Home"
          actionHref="/login"
          actionLabel="Pupil login"
        />

        {(!worldsAvailable || !runtimeAvailable) && (
          <div className="mt-5">
            <ApiStateCard
              kind="unavailable"
              tone="dark"
              title="Live learning service is unavailable"
              body="The portal cannot confirm the current worlds or access settings right now. No placeholder learning route has been shown; try again when the service is connected."
            />
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="rounded-lg border border-white/12 bg-[#142746]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Child entry</p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">Choose today&apos;s learning world</h1>
            <p className="mt-4 leading-7 text-white/68">
              Every portal leads to a real curriculum mission. Start with a predictable warm-up, learn with your companion, then grow your world with what you have proved.
            </p>
            <div className="mt-6 rounded-lg bg-[#ffbf45] p-5 text-[#17233f] shadow-[0_18px_42px_rgba(255,191,69,0.28)]">
              <div className="flex items-center gap-4">
                <div className="play-entry__orbit" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <p className="font-display text-sm uppercase tracking-[0.14em] opacity-70">Daily warm-up orbit</p>
                  <h2 className="font-display mt-2 text-2xl font-semibold">Retrieve, repair, then explore.</h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 opacity-80">A predictable retrieval ritual leads into the main mission, with support ready when you need it.</p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1" aria-label="Learning journey">
              {[
                ["1", "Warm up", "Remember one idea"],
                ["2", "Mission", "Learn and practise"],
                ["3", "Grow", "Earn and return"],
              ].map(([number, title, body], index) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${index === 0 ? "bg-[#ffbf45] text-[#17233f]" : "bg-white/12 text-white"}`}>{number}</span>
                  <div>
                    <p className="font-display text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-white/55">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/8 p-5">
              <p className="font-display text-sm uppercase tracking-[0.14em] text-[#ffbf45]">Next adaptive decision</p>
              <h2 className="font-display mt-2 text-2xl font-semibold">{publicDemoLearnerEnabled ? (nextActivity?.realm ?? "No route selected") : "Login unlocks the next route"}</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">
                {publicDemoLearnerEnabled ? (nextActivity?.explanation ?? "Publish a learner activity to make this route live.") : "The platform chooses the mission after it knows the child, their profile and their current evidence."}
              </p>
              {nextActivity && (
                <div className="mt-4 rounded-lg border border-[#ffdf8a]/20 bg-[#09172b]/70 p-4">
                  <p className="font-display text-xs uppercase tracking-[0.14em] text-[#ffdf8a]">Why this route?</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {nextDecisionFacts.map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/8 px-3 py-2">
                        <p className="text-[0.68rem] uppercase tracking-[0.12em] text-white/45">{label}</p>
                        <p className="mt-1 text-sm font-semibold capitalize text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  {nextActivity.recommended_actions.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm leading-6 text-white/72">
                      {nextActivity.recommended_actions.slice(0, 3).map((action) => (
                        <li key={action}>- {action}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs leading-5 text-white/55">
                    The mission keeps this decision explainable and records fresh evidence after each question.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {["Low-sensory safe", "Audio-ready", "No leaderboards"].map((label) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white/76">
                  {label}
                </div>
              ))}
            </div>
          </aside>

          <section aria-label="MVP subject pathways" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 sm:col-span-2 xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-xs uppercase tracking-[0.14em] text-[#ffdf8a]">MVP subject portals</p>
                  <p className="mt-1 text-sm text-white/62">Every world uses the same playful learning loop across the three launch subjects.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MVP_SUBJECTS.map((subject) => (
                    <span key={subject.name} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
                      <span className="grid h-5 w-5 place-items-center rounded-full text-[#17233f]" style={{ backgroundColor: subject.accent }}>{subject.icon}</span>
                      {subject.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {profiles.map((profile, index) => (
              <Link
                key={`${profile.year}-${profile.world}`}
                href={profile.route}
                className={`tile-press ${visualPortalsEnabled ? "world-portal" : ""} relative min-h-[258px] overflow-hidden rounded-lg border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] ${profile.live ? `${visualPortalsEnabled ? "world-portal--live" : ""} border-[#ffdf8a] bg-white text-[#17233f]` : "border-white/10 bg-white/10 text-white"}`}
                style={{ "--accent": profile.accent, "--delay": `${index * 110}ms` } as CSSProperties}
              >
                {visualPortalsEnabled && <PortalScene shape={profile.shape} live={profile.live} accent={profile.accent} />}
                <div className="flex items-start justify-between gap-3">
                  <div className="relative z-10 grid h-14 w-14 place-items-center rounded-lg font-display font-semibold text-[#17233f]" style={{ backgroundColor: profile.accent }}>
                    {profile.year.replace("Year ", "Y")}
                  </div>
                  {profile.live && showDemoBadges ? (
                    <span className="relative z-10 rounded-lg bg-[#ffbf45] px-3 py-1 text-xs font-bold text-[#17233f]">Next mission</span>
                  ) : (
                    <span className="relative z-10 rounded-lg bg-white/12 px-3 py-1 text-xs font-bold text-white/72">Use access card</span>
                  )}
                </div>
                <p className={`relative z-10 font-display mt-5 text-sm font-semibold ${profile.live ? "text-[#7357c9]" : "text-[#ffdf8a]"}`}>{profile.year}</p>
                <h2 className="relative z-10 font-display mt-1 text-2xl font-semibold">{profile.world}</h2>
                <p className={`relative z-10 mt-3 max-w-[14rem] text-sm leading-6 ${profile.live ? "text-[#17233f]/68" : "text-white/62"}`}>{profile.focus}</p>
                <div className="relative z-10 mt-4 flex flex-wrap gap-1.5">
                  {MVP_SUBJECTS.map((subject) => (
                    <span key={subject.name} className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${profile.live ? "bg-[#17233f]/8 text-[#17233f]/65" : "bg-white/10 text-white/65"}`}>{subject.name}</span>
                  ))}
                </div>
                <div className="absolute bottom-5 right-5 z-10">
                  <Dino mood={profile.live ? "happy" : "idle"} size={62} />
                </div>
              </Link>
            ))}
            {worldsAvailable && profiles.length === 0 && (
              <ApiStateCard
                kind="empty"
                tone="dark"
                title="No learning worlds are published"
                body="A platform administrator can configure and release the Year 1-7 worlds without changing the child application."
              />
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function PortalScene({ shape, live, accent }: { shape: (typeof WORLD_SHAPES)[number]; live: boolean; accent: string }) {
  const nodes = {
    seed: ["M50 16 C28 24 20 48 30 68 C42 92 74 84 78 54 C80 32 68 18 50 16Z", "M48 74 C44 55 48 36 60 24"],
    story: ["M22 24 H78 V78 H22 Z", "M50 24 V78 M32 38 H44 M56 38 H68 M32 52 H44 M56 52 H68"],
    island: ["M20 66 C34 42 68 38 82 66 C66 76 38 78 20 66Z", "M50 56 C48 42 54 30 66 22"],
    machine: ["M30 30 H70 V70 H30 Z", "M38 50 H62 M50 38 V62"],
    orbit: ["M22 50 C34 28 66 28 78 50 C66 72 34 72 22 50Z", "M50 24 A26 26 0 1 0 50 76 A26 26 0 1 0 50 24"],
    crest: ["M50 18 L76 30 V52 C76 68 64 78 50 84 C36 78 24 68 24 52 V30 Z", "M38 52 L47 61 L64 42"],
    lab: ["M40 20 H60 M45 20 V40 L28 76 H72 L55 40 V20", "M36 62 H64"],
  }[shape];

  return (
    <svg className="portal-scene" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="portal-scene__ring" cx="50" cy="50" r="38" stroke={accent} />
      <circle className="portal-scene__ring portal-scene__ring--inner" cx="50" cy="50" r="25" stroke={accent} />
      <path className="portal-scene__glyph" d={nodes[0]} fill={live ? accent : "none"} stroke={accent} />
      <path className="portal-scene__line" d={nodes[1]} stroke={live ? "#17233f" : accent} />
      <circle className="portal-scene__spark" cx="24" cy="28" r="2.5" fill={accent} />
      <circle className="portal-scene__spark portal-scene__spark--two" cx="78" cy="70" r="2.5" fill={accent} />
    </svg>
  );
}
