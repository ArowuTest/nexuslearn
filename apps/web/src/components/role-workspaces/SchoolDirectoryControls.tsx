"use client";

import type { DirectoryKind, DirectoryView } from "./useSchoolDirectories";

type Props = {
  label: string; kind: DirectoryKind; view: DirectoryView;
  edit: (kind: DirectoryKind, value: string) => void;
  navigate: (kind: DirectoryKind, action: "search" | "clear" | "next" | "previous" | "retry") => unknown;
};
export default function SchoolDirectoryControls({ label, kind, view, edit, navigate }: Props) {
  const button = "min-h-11 rounded-lg border border-[#17233f]/20 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50";
  return <form role="search" aria-label={`${label} directory`} className="grid gap-3 p-5 text-[#17233f]" onSubmit={event => { event.preventDefault(); void navigate(kind, "search"); }}>
    <label className="grid gap-2 text-sm font-semibold">Search {label.toLowerCase()}
      <input value={view.draft} maxLength={100} onChange={event => edit(kind, event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-[#17233f]/25 bg-white px-3 py-2" />
    </label>
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={button}>Search</button>
      <button type="button" className={button} onClick={() => void navigate(kind, "clear")}>Clear search</button>
      <button type="button" className={button} disabled={view.index === 0 || view.status === "loading"} onClick={() => void navigate(kind, "previous")}>Previous page</button>
      <button type="button" className={button} disabled={!view.next || view.status === "loading"} onClick={() => void navigate(kind, "next")}>Next page</button>
    </div>
    <p aria-live="polite" className="text-sm leading-6 text-[#42506b]">{view.status === "loading" ? "Loading directory…" : view.status === "error" ? view.error : `Page ${view.index + 1} · ${view.items.length ? `${view.items.length} results${view.next ? " · more available" : " · end of results"}` : "No matching results"}`}</p>
    {view.status === "error" && <button type="button" className={button} onClick={() => void navigate(kind, "retry")}>Retry</button>}
  </form>;
}
