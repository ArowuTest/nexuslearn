import Link from "next/link";

export type ChildJourneyStage = "route" | "learn" | "practise" | "grow";

const STAGES: Array<{ key: ChildJourneyStage; label: string; detail: string }> = [
  { key: "route", label: "Route", detail: "Choose today" },
  { key: "learn", label: "Learn", detail: "See the idea" },
  { key: "practise", label: "Practise", detail: "Show what you know" },
  { key: "grow", label: "Grow", detail: "Keep the progress" },
];

export default function ChildJourneyChrome({
  active,
  context,
  backHref,
  backLabel = "Back",
  actionHref,
  actionLabel,
}: {
  active: ChildJourneyStage;
  context: string;
  backHref: string;
  backLabel?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <header className="relative z-20 mx-auto max-w-6xl rounded-2xl border border-white/12 bg-[#17233f]/80 px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="font-display text-lg font-semibold text-white" aria-label="NexusLearn home">
          NexusLearn
        </Link>
        <div className="min-w-0 flex-1 px-2 text-center sm:px-4">
          <p className="font-display text-[0.68rem] uppercase tracking-[0.16em] text-[#ffdf8a]">Your learning route</p>
          <p className="truncate text-xs text-white/65">{context}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={backHref} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white">
            {backLabel}
          </Link>
          {actionHref && actionLabel && (
            <Link href={actionHref} className="rounded-lg bg-[#ffbf45] px-3 py-2 text-xs font-semibold text-[#17233f]">
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
      <nav className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Child learning route">
        {STAGES.map((stage) => {
          const isActive = stage.key === active;
          return (
            <div
              key={stage.key}
              className={`rounded-xl px-2 py-2 text-center ${isActive ? "bg-[#ffbf45] text-[#17233f]" : "bg-white/8 text-white/58"}`}
              aria-current={isActive ? "step" : undefined}
            >
              <p className="font-display text-xs font-semibold">{stage.label}</p>
              <p className="mt-0.5 hidden text-[0.65rem] sm:block">{stage.detail}</p>
            </div>
          );
        })}
      </nav>
    </header>
  );
}

export function ApiStateCard({
  kind,
  title,
  body,
  tone = "light",
}: {
  kind: "loading" | "empty" | "unavailable";
  title: string;
  body: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <section
      className={`rounded-2xl border p-5 ${dark ? "border-white/12 bg-white/8 text-white" : "border-[#17233f]/12 bg-[#fbfaf6] text-[#17233f]"}`}
      role={kind === "loading" ? "status" : "alert"}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold ${dark ? "bg-[#ffbf45] text-[#17233f]" : "bg-[#7357c9] text-white"}`} aria-hidden="true">
          {kind === "loading" ? "…" : kind === "empty" ? "–" : "!"}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className={`mt-1 text-sm leading-6 ${dark ? "text-white/68" : "text-[#17233f]/65"}`}>{body}</p>
        </div>
      </div>
    </section>
  );
}
