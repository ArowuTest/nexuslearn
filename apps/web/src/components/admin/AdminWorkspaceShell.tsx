"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  return (
    <main className="min-h-screen bg-[#f6f3ea] px-4 py-6 text-[#1d1a3e] sm:px-6 sm:py-8">
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
          <aside className="rounded-2xl bg-white p-3 shadow-card lg:sticky lg:top-6">
            <AdminNavigation activeSection={activeSection} visibleSections={visibleSections} onSelect={onSelect} />
          </aside>
          <div className="min-w-0">
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
          </div>
        </div>
      </div>
    </main>
  );
}
