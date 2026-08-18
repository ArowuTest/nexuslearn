import type { ReactNode } from "react";

export type WorkspaceNavigationItem = {
  href: `#${string}`;
  label: string;
  detail?: string;
};

export function WorkspaceNavigation({ label, items }: { label: string; items: WorkspaceNavigationItem[] }) {
  return (
    <nav aria-label={label} className="no-print sticky top-3 z-20 mt-5 overflow-x-auto rounded-2xl border border-[#17233f]/10 bg-white/95 p-2 shadow-card backdrop-blur">
      <ul className="flex min-w-max gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} className="block rounded-xl px-4 py-3 text-sm font-semibold text-[#17233f] transition hover:bg-[#f7f0df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7357c9]">
              {item.label}
              {item.detail ? <span className="ml-2 hidden text-xs font-normal text-[#17233f]/52 md:inline">{item.detail}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function WorkspaceSection({ id, eyebrow, title, detail, children, className = "" }: { id: string; eyebrow?: string; title: string; detail?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-28 overflow-hidden rounded-2xl bg-white shadow-card ${className}`}>
      <header className="border-b border-[#17233f]/10 p-5 md:p-6">
        {eyebrow ? <p className="font-display text-xs uppercase tracking-[0.16em] text-[#7357c9]">{eyebrow}</p> : null}
        <h2 className="font-display mt-1 text-2xl font-semibold text-[#17233f]">{title}</h2>
        {detail ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#17233f]/62">{detail}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function WorkspaceState({ tone = "neutral", children }: { tone?: "neutral" | "loading" | "error" | "success"; children: ReactNode }) {
  const style = tone === "error"
    ? "border-[#c65353]/25 bg-[#fff4f2] text-[#7c2f2f]"
    : tone === "success"
      ? "border-[#2c9b63]/25 bg-[#effaf2] text-[#215d26]"
      : tone === "loading"
        ? "border-[#55cbd3]/30 bg-[#f3fbfc] text-[#155d64]"
        : "border-[#17233f]/10 bg-white/80 text-[#17233f]/68";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${style}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {children}
    </div>
  );
}
