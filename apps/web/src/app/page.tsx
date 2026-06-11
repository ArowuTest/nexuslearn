import Link from "next/link";
import Dino from "@/components/Dino";

const WORLDS = [
  { year: "Year 1", name: "Number Garden & Letter Zoo", emoji: "🌻", color: "bg-leaf" },
  { year: "Year 2", name: "Enchanted Storybook Kingdom", emoji: "📖", color: "bg-grape" },
  { year: "Year 3", name: "Explorer Islands", emoji: "🗺️", color: "bg-lagoon" },
  { year: "Year 4", name: "Dino-Craft Builder World", emoji: "🦕", color: "bg-sun" },
  { year: "Year 5", name: "Space Engineers & Eco Cities", emoji: "🚀", color: "bg-sky" },
  { year: "Year 6", name: "Quest Academy", emoji: "🏆", color: "bg-coral" },
  { year: "Year 7", name: "Future Worlds Lab", emoji: "🔬", color: "bg-grape" },
];

const PILLARS = [
  {
    emoji: "🎯",
    title: "Curriculum-mapped, not random",
    body: "Every mission targets a National Curriculum objective — with prerequisites, misconceptions and a real mastery model behind the fun.",
  },
  {
    emoji: "🧠",
    title: "Adapts to every child",
    body: "Struggling with area? We quietly check times tables, counting and reading first — then rebuild the foundation and return stronger.",
  },
  {
    emoji: "🎮",
    title: "Feels like play",
    body: "Worlds grow as children master skills. Companions react, eggs hatch, cities rise. No worksheets in disguise.",
  },
  {
    emoji: "📊",
    title: "Clear for parents & schools",
    body: "Mastery heatmaps, gap analysis, intervention groups and plain-English reports — evidence, not just activity counts.",
  },
];

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#241f56] via-[#2e2870] to-[#43349b] text-white">
        {/* stars */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            [8, 15], [22, 8], [38, 22], [55, 10], [70, 18], [85, 12], [93, 30],
            [15, 40], [80, 45], [45, 38],
          ].map(([x, y], i) => (
            <span
              key={i}
              className="absolute text-sun anim-glow"
              style={{ left: `${x}%`, top: `${y}%`, fontSize: i % 3 === 0 ? 18 : 11 }}
            >
              ✦
            </span>
          ))}
        </div>

        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 pb-24 pt-20 md:flex-row md:gap-6">
          <div className="max-w-xl">
            <p className="font-display mb-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm tracking-wide text-sun">
              UK National Curriculum · Years 1–7
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
              Learning worlds where every lesson is an{" "}
              <span className="text-sun">adventure</span>
            </h1>
            <p className="mt-5 text-lg text-white/85">
              NexusLearn turns reading, writing, maths and science into missions,
              worlds and stories — adapting to every child while parents and
              schools see real curriculum progress.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/play"
                className="btn-pop bg-sun px-8 py-4 text-lg text-ink"
              >
                ▶ Try a mission
              </Link>
              <Link
                href="/parents"
                className="btn-pop bg-white/15 px-8 py-4 text-lg text-white backdrop-blur"
              >
                For parents & schools
              </Link>
            </div>
          </div>

          <div className="anim-float relative">
            <div className="absolute -inset-8 rounded-full bg-sun/20 blur-3xl" aria-hidden />
            <div className="relative rounded-blob bg-white/10 p-8 backdrop-blur">
              <Dino mood="celebrate" size={230} />
              <p className="font-display mt-2 text-center text-white/90">
                Rex — your learning companion
              </p>
            </div>
          </div>
        </div>

        {/* wave divider */}
        <svg viewBox="0 0 1440 90" className="block w-full" aria-hidden>
          <path
            d="M0,40 C240,90 480,0 720,30 C960,60 1200,80 1440,30 L1440,90 L0,90 Z"
            fill="#fdf8ef"
          />
        </svg>
      </section>

      {/* PILLARS */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-center text-3xl font-semibold md:text-4xl">
          Fun for children. <span className="text-grape">Evidence for grown-ups.</span>
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="tile-press rounded-blob bg-white p-8 shadow-card"
            >
              <div className="text-4xl">{p.emoji}</div>
              <h3 className="font-display mt-3 text-xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-ink/70">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WORLDS */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="font-display text-center text-3xl font-semibold md:text-4xl">
            A world for every year group
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ink/60">
            One learning engine, seven beautifully different worlds — tuned to
            each age, from audio-led Year 1 gardens to Year 7 simulation labs.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORLDS.map((w) => (
              <div
                key={w.year}
                className="tile-press rounded-blob border-2 border-ink/5 bg-cream p-6 text-center shadow-card"
              >
                <div
                  className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${w.color} text-3xl shadow-pop`}
                >
                  {w.emoji}
                </div>
                <p className="font-display mt-4 text-sm font-medium text-grape">
                  {w.year}
                </p>
                <h3 className="font-display text-lg font-semibold leading-snug">
                  {w.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="rounded-blob bg-gradient-to-br from-grape to-sky p-12 text-white shadow-card">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            Ready for the first mission?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Play the Year 4 Dino-Craft demo — power the incubator with your
            times tables and hatch your first companion.
          </p>
          <Link
            href="/play"
            className="btn-pop mt-8 inline-block bg-sun px-10 py-4 text-lg text-ink"
          >
            🦕 Start the demo
          </Link>
        </div>
        <p className="mt-10 text-sm text-ink/40">
          NexusLearn · WonderPath Learning — built privacy-first for children
          (UK GDPR & ICO Children&apos;s Code by design)
        </p>
      </section>
    </main>
  );
}
