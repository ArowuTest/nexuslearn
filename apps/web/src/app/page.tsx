import Link from "next/link";
import type { CSSProperties } from "react";
import Dino from "@/components/Dino";
import { DEFAULT_STUDENT_ID, getNextActivity, getWorlds } from "@/lib/api";

const QUALITY_BARS = [
  "Every mission maps to an objective, prerequisite and misconception.",
  "Every child gets instant feedback, a scaffolded retry and a reason to return.",
  "Every portal, companion and world change has a learning purpose.",
  "Every parent and teacher view explains progress in plain English.",
];

const LOOPS = [
  {
    title: "Daily warm-up",
    body: "Three spaced-retrieval questions begin each session so practice becomes predictable, quick and confidence-building.",
  },
  {
    title: "Living hub",
    body: "Mastered objectives add permanent portals, artefacts, tools and discoveries to the child's personal Nexus hub.",
  },
  {
    title: "Companion team",
    body: "Learning companions have roles across phonics, maths, science, maps and logic, with safe bounded memory.",
  },
  {
    title: "Mistake Museum",
    body: "Corrected misconceptions become trophies, so errors feel like progress instead of failure.",
  },
];

function ScenePreview({ title, subtitle, accent }: { title: string; subtitle: string; accent: string }) {
  return (
    <div className="relative mx-auto aspect-[1.08] w-full max-w-[470px] overflow-hidden rounded-[2rem] border border-white/20 bg-[#173d43] shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#466cb3] to-transparent" />
      <div className="absolute left-10 top-10 h-12 w-12 rounded-full shadow-[0_0_44px_rgba(255,214,107,0.75)]" style={{ backgroundColor: accent }} />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-[#2c8a63]" />
      <div className="absolute bottom-[32%] left-0 right-0 h-20 bg-[#246f5f]" style={{ clipPath: "polygon(0 72%, 18% 40%, 36% 64%, 54% 26%, 72% 58%, 100% 20%, 100% 100%, 0 100%)" }} />

      <div className="absolute bottom-16 left-1/2 grid -translate-x-1/2 grid-cols-5 gap-2">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className={`iso-tile ${i % 4 === 0 ? "bg-[#ffbf45]" : i % 3 === 0 ? "bg-[#55cbd3]" : "bg-[#73d889]"}`}
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      <div className="absolute bottom-20 left-7 rounded-2xl bg-white/92 p-3 text-[#17233f] shadow-card">
        <p className="font-display text-sm font-semibold">Portal restored</p>
        <p className="text-xs text-[#17233f]/65">{subtitle}</p>
      </div>

      <div className="absolute bottom-8 right-5">
        <Dino mood="celebrate" size={138} />
      </div>

      <div className="absolute right-6 top-7 rounded-2xl bg-white/14 px-4 py-3 text-white backdrop-blur">
        <p className="text-xs uppercase tracking-[0.16em] text-white/60">{title}</p>
        <p className="font-display text-xl font-semibold">Mission portal ready</p>
      </div>
    </div>
  );
}

export default async function Home() {
  const [worlds, nextActivity] = await Promise.all([
    getWorlds(),
    getNextActivity(DEFAULT_STUDENT_ID),
  ]);
  const configuredWorlds = worlds ?? [];
  const activeWorld = configuredWorlds.find((world) => world.key === nextActivity?.world_key) ?? configuredWorlds[0];
  const activeAccent = String(activeWorld?.config?.accent || "#ffbf45");
  const activeTitle = activeWorld?.name ?? "Configured world";
  const activeSubtitle = nextActivity?.explanation ?? activeWorld?.theme ?? "No learner mission is configured yet.";

  return (
    <main className="bg-cream text-ink">
      <section className="relative min-h-screen overflow-hidden bg-[#17233f] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(85,203,211,0.26),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(255,191,69,0.22),transparent_25%),linear-gradient(180deg,#17233f_0%,#244b58_62%,#fdf8ef_62%)]" />
        <div className="absolute inset-x-0 bottom-[30%] h-28 bg-[#2c8a63]" style={{ clipPath: "polygon(0 60%, 12% 46%, 26% 64%, 38% 36%, 52% 58%, 70% 24%, 86% 50%, 100% 30%, 100% 100%, 0 100%)" }} />

        <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 pb-20 pt-12 lg:grid-cols-[1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="font-display inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm text-[#ffe2a0] backdrop-blur">
              UK Years 1-7 adaptive learning universe
            </p>
            <h1 className="font-display mt-6 text-5xl font-semibold leading-[0.98] md:text-7xl">
              NexusLearn
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-8 text-white/82">
              A curriculum-mapped learning universe where children open portals, build
              persistent worlds, repair misconceptions and master real objectives through animated missions.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/play" className="btn-pop bg-[#ffbf45] px-7 py-4 text-[#17233f]">
                Enter the Nexusverse
              </Link>
              <Link href="/parents" className="btn-pop border border-white/18 bg-white/12 px-7 py-4 text-white backdrop-blur">
                View progress dashboard
              </Link>
            </div>
            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
              {QUALITY_BARS.map((bar) => (
                <div key={bar} className="rounded-2xl border border-white/12 bg-white/8 p-4 text-sm text-white/78 backdrop-blur">
                  {bar}
                </div>
              ))}
            </div>
          </div>

          <ScenePreview title={activeTitle} subtitle={activeSubtitle} accent={activeAccent} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-grape">The product loop</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">Built for joy, evidence and return visits.</h2>
            <p className="mt-4 text-lg leading-8 text-ink/68">
              The platform should not be a quiz wearing a costume. Each learning act should change
              the child's world, inform the adaptive engine and give adults a useful signal.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {LOOPS.map((loop) => (
              <article key={loop.title} className="rounded-2xl bg-white p-6 shadow-card">
                <h3 className="font-display text-xl font-semibold">{loop.title}</h3>
                <p className="mt-2 leading-7 text-ink/64">{loop.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-grape">Seven realms, one curriculum engine</p>
            <h2 className="font-display mt-3 text-4xl font-semibold">Age-tuned, not one-size-fits-all.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {configuredWorlds.map((world, index) => {
              const accent = String(world.config?.accent || "#ffbf45");
              const focus = String(world.config?.focus || world.theme);
              const year = world.year_group ? `Year ${world.year_group}` : "School";
              return (
                <article key={world.key} className="group min-h-[210px] overflow-hidden rounded-2xl bg-cream p-6 shadow-card">
                  <div
                    className="h-16 w-16 rounded-[44%_56%_52%_48%] shadow-pop transition-transform group-hover:scale-110"
                    style={{ backgroundColor: accent, transform: `rotate(${(index % 4) * 5 - 8}deg)` } as CSSProperties}
                  />
                  <p className="font-display mt-6 text-sm font-semibold text-grape">{year}</p>
                  <h3 className="font-display mt-1 text-2xl font-semibold">{world.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink/62">{focus}</p>
                </article>
              );
            })}
            {configuredWorlds.length === 0 && (
              <article className="min-h-[210px] rounded-2xl bg-cream p-6 shadow-card md:col-span-2 xl:col-span-4">
                <p className="font-display text-sm font-semibold text-grape">Configuration needed</p>
                <h3 className="font-display mt-2 text-2xl font-semibold">No enabled learner worlds are configured yet.</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/62">
                  Add enabled worlds in the admin console to publish the Year 1-7 realm catalogue here.
                </p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-2">
        <div className="rounded-2xl bg-[#17233f] p-8 text-white shadow-card">
          <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffbf45]">Current live world</p>
          <h2 className="font-display mt-3 text-3xl font-semibold">{activeTitle}</h2>
          <p className="mt-4 leading-8 text-white/76">
            {activeWorld?.theme ?? "Configure the first enabled world to turn this section into the current product focus."}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-card">
          <p className="font-display text-sm uppercase tracking-[0.18em] text-grape">Next build slice</p>
          <h2 className="font-display mt-3 text-3xl font-semibold">Adaptive core and content pipeline.</h2>
          <p className="mt-4 leading-8 text-ink/66">
            PostgreSQL, objective packs, explainable mastery updates, warm-up orbit, prerequisite probes
            and a content CMS are the next serious step after the playable experience.
          </p>
        </div>
      </section>
    </main>
  );
}
