import Link from "next/link";
import type { CSSProperties } from "react";
import Dino from "@/components/Dino";
import { DEFAULT_STUDENT_ID, getNextActivity, getRuntimeFlags, getWorlds } from "@/lib/api";

const PROFILES = [
  ["Ava", "Year 1", "Wonder Garden", "Counting, phonics and listening", "#8be28f"],
  ["Sophia", "Year 2", "Story Kingdom", "Reading fluency and sentence building", "#f7a6d8"],
  ["Maya", "Year 3", "Explorer Archipelago", "Times tables, fractions and discovery", "#55cbd3"],
  ["Alex", "Year 4", "Inventor Wilds", "Maths machines, science labs and expedition writing", "#ffbf45"],
  ["Noah", "Year 5", "Orbit Cities", "Reasoning, percentages and systems", "#74a7ff"],
  ["Isla", "Year 6", "Mastery Academy", "SATs confidence and mastery paths", "#ff7b73"],
  ["Zain", "Year 7", "Future Lab", "Secondary transition and simulations", "#9d82ff"],
] as const;

export default async function PlayEntry() {
  const [worlds, nextActivity, runtimeFlags] = await Promise.all([
    getWorlds(),
    getNextActivity(DEFAULT_STUDENT_ID),
    getRuntimeFlags(),
  ]);
  const flags = runtimeFlags?.flags ?? {};
  const childPlayEnabled = flags.child_play_enabled !== false;
  const showDemoBadges = flags.show_demo_badges !== false;
  const profiles = worlds?.length
    ? worlds.filter((world) => world.year_group).map((world) => ({
        name: String(world.config?.companion || world.name),
        year: `Year ${world.year_group}`,
        world: world.name,
        focus: String(world.config?.focus || world.theme),
        accent: String(world.config?.accent || "#ffbf45"),
        route: `/play/mission?studentId=${encodeURIComponent(DEFAULT_STUDENT_ID)}&world=${encodeURIComponent(world.key)}`,
        live: world.key === nextActivity?.world_key,
      }))
    : PROFILES.map(([name, year, world, focus, accent]) => ({
        name,
        year,
        world,
        focus,
        accent,
        route: "/play/mission",
        live: name === "Alex",
      }));

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
    <main className="min-h-screen bg-[#111a33] text-white">
      <div className="mx-auto max-w-7xl px-5 py-5">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-semibold">NexusLearn</Link>
          <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">Home</Link>
        </nav>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.68fr_1.32fr]">
          <aside className="rounded-lg border border-white/10 bg-white/8 p-6">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Child entry</p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">Choose a learning world</h1>
            <p className="mt-4 leading-7 text-white/68">
              Each world is connected to a year group, curriculum route and adaptive mission. The highlighted world is the current next route.
            </p>
            <div className="mt-6 rounded-lg bg-[#ffbf45] p-5 text-[#17233f]">
              <p className="font-display text-sm uppercase tracking-[0.14em] opacity-70">Daily warm-up orbit</p>
              <h2 className="font-display mt-2 text-2xl font-semibold">Start small, then open the portal.</h2>
              <p className="mt-3 text-sm leading-6 opacity-80">A predictable retrieval ritual leads into the main mission.</p>
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/8 p-5">
              <p className="font-display text-sm uppercase tracking-[0.14em] text-[#ffbf45]">Next adaptive decision</p>
              <h2 className="font-display mt-2 text-2xl font-semibold">{nextActivity?.realm ?? "No route selected"}</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">{nextActivity?.explanation ?? "Publish a learner activity to make this route live."}</p>
            </div>
          </aside>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <Link
                key={`${profile.year}-${profile.world}`}
                href={profile.route}
                className={`tile-press relative min-h-[220px] rounded-lg border p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] ${profile.live ? "border-[#ffdf8a] bg-white text-[#17233f]" : "border-white/10 bg-white/10 text-white"}`}
                style={{ "--accent": profile.accent } as CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-lg font-display font-semibold text-[#17233f]" style={{ backgroundColor: profile.accent }}>
                    {profile.year.replace("Year ", "Y")}
                  </div>
                  {profile.live && showDemoBadges && (
                    <span className="rounded-lg bg-[#ffbf45] px-3 py-1 text-xs font-bold text-[#17233f]">Live</span>
                  )}
                </div>
                <p className={`font-display mt-5 text-sm font-semibold ${profile.live ? "text-[#7357c9]" : "text-[#ffdf8a]"}`}>{profile.year}</p>
                <h2 className="font-display mt-1 text-2xl font-semibold">{profile.world}</h2>
                <p className={`mt-3 text-sm leading-6 ${profile.live ? "text-[#17233f]/68" : "text-white/62"}`}>{profile.focus}</p>
                <div className="absolute bottom-5 right-5">
                  <Dino mood={profile.live ? "happy" : "idle"} size={62} />
                </div>
              </Link>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
