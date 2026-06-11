import Link from "next/link";

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

export default function PlayEntry() {
  return (
    <main className="min-h-screen bg-[#17233f] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Child entry</p>
            <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">Choose a learning world</h1>
            <p className="mt-3 max-w-2xl text-white/68">
              The full product gives each child an age-tuned realm connected by the Nexus hub. The current
              live proof mission starts in Year 4 Inventor Wilds, while the architecture is planned for Years 1-7.
            </p>
          </div>
          <Link href="/" className="btn-pop border border-white/16 bg-white/10 px-5 py-3 text-sm">
            Home
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROFILES.map((profile, i) => (
            <Link
              key={profile.name}
              href={profile.route}
              className="tile-press anim-pop relative min-h-[245px] overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur"
              style={{ animationDelay: `${i * 60}ms` }}
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
      </div>
    </main>
  );
}
