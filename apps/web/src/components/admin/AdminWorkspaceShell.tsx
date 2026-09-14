"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import AdminNavigation from "./AdminNavigation";
import type { AdminSectionId } from "./adminSectionModel";

type SummaryItem = { label: string; value: number };

type AdminWorkspaceShellProps = {
  activeSection: AdminSectionId;
  visibleSections: readonly AdminSectionId[];
  roleLabel: string;
  message: string;
  totals: SummaryItem[];
  onSelect: (section: AdminSectionId) => void;
  onSignOut: () => void;
  children: ReactNode;
};

export default function AdminWorkspaceShell({
  activeSection,
  visibleSections,
  roleLabel,
  message,
  totals,
  onSelect,
  onSignOut,
  children,
}: AdminWorkspaceShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLElement>(null);
  const focusOwner = useRef<"toggle" | "navigation" | null>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (desktop.matches) {
        setMenuOpen(false);
        if (focusOwner.current === "toggle") {
          navigation.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
        }
      } else if (focusOwner.current === "navigation") {
        menuButton.current?.focus();
      }
    };
    desktop.addEventListener("change", resize);
    return () => desktop.removeEventListener("change", resize);
  }, []);

  function rememberFocus(target: EventTarget | null) {
    // CSS can blur a hidden control before the media-query callback runs.
    // Track deliberate focus/pointer moves, including moves outside the menu.
    focusOwner.current = target instanceof Node && menuButton.current?.contains(target) ? "toggle"
      : target instanceof Node && navigation.current?.contains(target) ? "navigation" : null;
  }

  function select(section: AdminSectionId) {
    onSelect(section);
    if (menuButton.current?.getClientRects().length) {
      setMenuOpen(false);
      // Wait for the selected region's accessible name/content to commit.
      // Unmount clears the ref, so a late frame cannot focus another account.
      requestAnimationFrame(() => content.current?.focus());
    }
  }

  return (
    <main onFocusCapture={event => rememberFocus(event.target)} onPointerDownCapture={event => rememberFocus(event.target)} className="min-h-screen bg-[#f6f3ea] px-4 py-6 text-[#1d1a3e] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[96rem]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Platform admin</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">Configuration control room</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#565267]">
              Govern organisations, curriculum, learner operations, assets and releases from one authenticated workspace.
            </p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-3 text-sm shadow-card">Home</Link>
        </header>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 bg-white p-4 shadow-card">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#565267]">Authenticated workspace</p>
            <p className="mt-1 text-sm font-semibold">{roleLabel}</p>
          </div>
          <button type="button" onClick={onSignOut} className="btn-pop bg-[#1d1a3e] px-5 py-3 text-sm text-white">Sign out</button>
        </div>

        <p className="mt-4 bg-white/70 px-4 py-3 text-sm text-[#565267]" role="status">{message}</p>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="rounded-2xl bg-white p-3 shadow-card lg:sticky lg:top-6" onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen && menuButton.current?.getClientRects().length) {
              event.preventDefault();
              setMenuOpen(false);
              menuButton.current.focus();
            }
          }}>
            <button
              ref={menuButton}
              type="button"
              aria-label={`Sections: ${activeSection}`}
              aria-expanded={menuOpen}
              aria-controls="admin-navigation"
              onClick={() => setMenuOpen(open => !open)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7357c9] lg:hidden"
            >
              <span>Sections <span className="ml-2 font-normal">{activeSection}</span></span>
              <span aria-hidden="true">{menuOpen ? "−" : "+"}</span>
            </button>
            <div ref={navigation} id="admin-navigation" className={menuOpen ? "mt-3 lg:mt-0" : "hidden lg:block"}>
              <AdminNavigation activeSection={activeSection} visibleSections={visibleSections} onSelect={select} />
            </div>
          </aside>
          <section ref={content} aria-label={`${activeSection} workspace`} tabIndex={-1} className="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7357c9]">
            {activeSection === "Overview" && (
              <section aria-labelledby="admin-overview-title">
                <div className="rounded-2xl bg-[#1d1a3e] p-6 text-white shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffcf70]">Operational workspace</p>
                  <h2 id="admin-overview-title" className="font-display mt-2 text-3xl font-semibold">Platform overview</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
                    Choose a focused area from the menu. Human safeguarding, listening and pilot evidence remain explicit release gates and are never replaced by automated review.
                  </p>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {totals.map((item) => (
                    <article key={item.label} className="rounded-2xl bg-white p-5 shadow-card">
                      <p className="font-display text-3xl font-semibold">{item.value}</p>
                      <p className="mt-1 text-sm text-[#565267]">{item.label}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
