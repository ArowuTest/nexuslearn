import Link from "next/link";
import type { CSSProperties } from "react";
import Dino from "@/components/Dino";
import { DEFAULT_STUDENT_ID, getNextActivity, getRuntimeFlags, getWorlds } from "@/lib/api";

const WORLD_SHAPES = ["seed", "story", "island", "machine", "orbit", "crest", "lab"] as const;

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
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-semibold">NexusLearn</Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/login" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">Pupil login</Link>
            <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">Home</Link>
          </div>
        </nav>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <aside className="rounded-lg border border-white/12 bg-[#142746]/88 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Child entry</p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">Open today&apos;s learning portal</h1>
            <p className="mt-4 leading-7 text-white/68">
              Every portal is connected to configured curriculum, an adaptive mission route and a companion style. Children open a real route through their issued login card or family profile.
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
              <p className="mt-3 text-sm leading-6 opacity-80">A predictable retrieval ritual leads into the main mission.</p>
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/8 p-5">
              <p className="font-display text-sm uppercase tracking-[0.14em] text-[#ffbf45]">Next adaptive decision</p>
              <h2 className="font-display mt-2 text-2xl font-semibold">{publicDemoLearnerEnabled ? (nextActivity?.realm ?? "No route selected") : "Login unlocks the next route"}</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">
                {publicDemoLearnerEnabled ? (nextActivity?.explanation ?? "Publish a learner activity to make this route live.") : "The platform chooses the mission after it knows the child, their profile and their current evidence."}
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {["Low-sensory safe", "Audio-ready", "No leaderboards"].map((label) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white/76">
                  {label}
                </div>
              ))}
            </div>
          </aside>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                    <span className="relative z-10 rounded-lg bg-[#ffbf45] px-3 py-1 text-xs font-bold text-[#17233f]">Next</span>
                  ) : (
                    <span className="relative z-10 rounded-lg bg-white/12 px-3 py-1 text-xs font-bold text-white/72">Login</span>
                  )}
                </div>
                <p className={`relative z-10 font-display mt-5 text-sm font-semibold ${profile.live ? "text-[#7357c9]" : "text-[#ffdf8a]"}`}>{profile.year}</p>
                <h2 className="relative z-10 font-display mt-1 text-2xl font-semibold">{profile.world}</h2>
                <p className={`relative z-10 mt-3 max-w-[14rem] text-sm leading-6 ${profile.live ? "text-[#17233f]/68" : "text-white/62"}`}>{profile.focus}</p>
                <div className="absolute bottom-5 right-5 z-10">
                  <Dino mood={profile.live ? "happy" : "idle"} size={62} />
                </div>
              </Link>
            ))}
            {profiles.length === 0 && (
              <div className="rounded-lg border border-white/10 bg-white/10 p-6 text-sm leading-6 text-white/68 sm:col-span-2 xl:col-span-3">
                No learning worlds are currently published. A platform administrator can configure and release Year 1-7 worlds without changing the child application.
              </div>
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
