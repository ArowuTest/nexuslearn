import Link from "next/link";
import type { CSSProperties } from "react";
import { DEFAULT_STUDENT_ID, getNextActivity, getWorlds } from "@/lib/api";

const PROFILES = [
  {
    name: "Ava",
    year: "Year 1",
    world: "Wonder Garden",
    focus: "Counting, phonics and listening",
    color: "bg-[#8be28f]",
    route: "/play/mission",
  },
  {
    name: "Sophia",
    year: "Year 2",
    world: "Story Kingdom",
    focus: "Reading fluency and sentence building",
    color: "bg-[#f7a6d8]",
    route: "/play/mission",
  },
  {
    name: "Maya",
    year: "Year 3",
    world: "Explorer Archipelago",
    focus: "Times tables, fractions and discovery",
    color: "bg-[#55cbd3]",
    route: "/play/mission",
  },
  {
    name: "Alex",
    year: "Year 4",
    world: "Inventor Wilds",
    focus: "Maths machines, science labs and expedition writing",
    color: "bg-[#ffbf45]",
    route: "/play/mission",
    live: true,
  },
  {
    name: "Noah",
    year: "Year 5",
    world: "Orbit Cities",
    focus: "Reasoning, percentages and systems",
    color: "bg-[#74a7ff]",
    route: "/play/mission",
  },
  {
    name: "Isla",
    year: "Year 6",
    world: "Mastery Academy",
    focus: "SATs confidence and mastery paths",
    color: "bg-[#ff7b73]",
    route: "/play/mission",
  },
  {
    name: "Zain",
    year: "Year 7",
    world: "Future Lab",
    focus: "Secondary transition and simulations",
    color: "bg-[#9d82ff]",
    route: "/play/mission",
  },
  {
    name: "Class 4B",
    year: "School",
    world: "Co-op Volcano Quest",
    focus: "Shared class goal without leaderboards",
    color: "bg-[#2c8a63]",
    route: "/play/mission",
  },
];

export default async function PlayEntry() {
  const [worlds, nextActivity] = await Promise.all([
    getWorlds(),
    getNextActivity(DEFAULT_STUDENT_ID),
  ]);
  const profiles = worlds?.length
    ? worlds.map((world) => ({
        name: String(world.config?.companion || world.name),
        year: world.year_group ? `Year ${world.year_group}` : "School",
        world: world.name,
        focus: String(world.config?.focus || world.theme),
        color: "bg-[var(--accent)]",
        accent: String(world.config?.accent || "#ffbf45"),
        route: `/play/mission?studentId=${encodeURIComponent(DEFAULT_STUDENT_ID)}&world=${encodeURIComponent(world.key)}`,
        live: world.key === nextActivity?.world_key,
      }))
    : PROFILES.map((profile) => ({ ...profile, accent: "" }));

  return (
    <main className="min-h-screen bg-[#17233f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Child entry</p>
            <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">Choose a learning world</h1>
            <p className="mt-3 max-w-2xl text-white/68">
              The full product gives each child an age-tuned realm connected by the Nexus hub. These worlds now come
              from the configured platform catalogue, with the next mission selected by the learning engine.
            </p>
          </div>
          <Link href="/" className="btn-pop border border-white/16 bg-white/10 px-5 py-3 text-sm">
            Home
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profiles.map((profile, i) => (
            <Link
              key={profile.name}
              href={profile.route}
              className="tile-press anim-pop relative min-h-[245px] overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur"
              style={{ animationDelay: `${i * 60}ms`, "--accent": profile.accent } as CSSProperties}
            >
              <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full ${profile.color} opacity-80 blur-[1px]`} />
              {profile.live && (
                <span className="absolute right-4 top-4 rounded-full bg-[#ffbf45] px-3 py-1 text-xs font-bold text-[#17233f]">
                  Live demo
                </span>
              )}
              <div className={`h-20 w-20 ${profile.color} rounded-[38%_62%_48%_52%] shadow-pop`} />
              <p className="font-display mt-6 text-sm font-semibold text-[#ffdf9a]">{profile.year}</p>
              <h2 className="font-display mt-1 text-2xl font-semibold">{profile.name}</h2>
              <p className="mt-1 font-semibold text-white/86">{profile.world}</p>
              <p className="mt-3 text-sm leading-6 text-white/62">{profile.focus}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/8 p-6 text-white/74">
          <p className="font-display text-lg font-semibold text-white">Planned login model</p>
          <p className="mt-2 leading-7">
            Home children use profile tiles and a PIN or picture password. School pupils use a school
            code, class tile and simple credential card, with no child email required.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.7fr_1fr]">
          <section className="rounded-2xl bg-[#ffbf45] p-6 text-[#17233f] shadow-card">
            <p className="font-display text-sm uppercase tracking-[0.16em] opacity-70">Daily warm-up orbit</p>
            <h2 className="font-display mt-2 text-2xl font-semibold">Start small, then open the portal.</h2>
            <p className="mt-3 leading-7 opacity-80">
              Each child begins with a short predictable retrieval ritual before the main mission.
              This keeps practice calm, focused and adaptive.
            </p>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/8 p-6 text-white/74">
            <p className="font-display text-sm uppercase tracking-[0.16em] text-[#ffbf45]">Next adaptive decision</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-white">
              {nextActivity?.realm ?? "Year 4 Inventor Wilds - Dino Lab biome"}
            </h2>
            <p className="mt-3 leading-7">
              {nextActivity?.explanation ??
                "Reviewing 7 x 8 because it was missed recently; using an array scaffold before returning to area."}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
