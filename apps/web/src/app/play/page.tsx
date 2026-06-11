import Link from "next/link";

const PROFILES = [
  { name: "Alex", world: "Dino Lab", emoji: "🦖", color: "bg-leaf", year: "Year 4" },
  { name: "Sophia", world: "Story Garden", emoji: "🦄", color: "bg-grape", year: "Year 2" },
  { name: "Maya", world: "Space Builders", emoji: "🚀", color: "bg-sky", year: "Year 5" },
  { name: "Class 4B", world: "Volcano Quest", emoji: "🌋", color: "bg-coral", year: "Year 4" },
];

export default function PlayEntry() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#241f56] to-[#43349b] px-6 py-16 text-white">
      <h1 className="font-display text-center text-3xl font-semibold md:text-5xl">
        Who&apos;s learning today?
      </h1>
      <p className="mt-3 text-white/70">Tap your name to enter your world</p>

      <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-6 md:grid-cols-4">
        {PROFILES.map((p, i) => (
          <Link
            key={p.name}
            href="/play/mission"
            className="tile-press anim-pop flex flex-col items-center rounded-blob bg-white/10 p-6 backdrop-blur hover:bg-white/15"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full ${p.color} text-4xl shadow-pop`}
            >
              {p.emoji}
            </div>
            <p className="font-display mt-4 text-xl font-semibold">{p.name}</p>
            <p className="text-sm text-white/60">
              {p.name === "Class 4B" ? "" : `${p.name}'s `}
              {p.world}
            </p>
            <p className="mt-1 rounded-full bg-white/10 px-3 py-0.5 text-xs text-sun">
              {p.year}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-12 max-w-md text-center text-sm text-white/50">
        Demo profiles — in the full product children sign in with their avatar
        and a PIN or picture password. No email needed.
      </p>
      <Link href="/" className="mt-4 text-sm text-white/60 underline">
        ← Back to home
      </Link>
    </main>
  );
}
