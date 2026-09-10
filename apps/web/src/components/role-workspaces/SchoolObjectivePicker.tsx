"use client";

import { useEffect, useId, useRef, useState } from "react";
import { accountSessionHeaders, subscribeAccountSession } from "@/lib/api";
import { LabeledSelect } from "./SchoolWorkspacePrimitives";

export type SchoolObjective = { id: string; year: number; subject: string; strand: string; topic: string; statement: string; teacher_evidence: string };
type Filters = { year: number; subject: string; query: string };
type Page = Filters & { objectives: SchoolObjective[]; limit: number; release_id: string; has_more: boolean; next_cursor: string };
const subjects = ["English", "Mathematics", "Science"];
const authorization = () => accountSessionHeaders(["school_admin", "teacher"]).Authorization ?? "";
const button = "min-h-11 rounded-lg border border-[#17233f]/20 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7357c9]";

function validPage(value: unknown, filter: Filters, cursors: string[], release?: string): value is Page {
  const page = value as Page;
  return !!page && page.year === filter.year && page.subject === filter.subject && page.query === filter.query && page.limit === 12
    && typeof page.release_id === "string" && !!page.release_id && (!release || page.release_id === release)
    && typeof page.has_more === "boolean" && typeof page.next_cursor === "string"
    && (!page.has_more || !!page.next_cursor && !cursors.includes(page.next_cursor))
    && Array.isArray(page.objectives) && page.objectives.length <= 12
    && page.objectives.every(item => item && typeof item.id === "string" && !!item.id && item.year === filter.year
      && subjects.includes(item.subject) && (!filter.subject || item.subject === filter.subject)
      && [item.strand, item.topic, item.statement, item.teacher_evidence].every(text => typeof text === "string") && !!item.statement)
    && new Set(page.objectives.map(item => item.id)).size === page.objectives.length;
}

export default function SchoolObjectivePicker({ year, disabled, value, onChange }: {
  year: number; disabled: boolean; value: SchoolObjective | null; onChange: (value: SchoolObjective | null) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ year, subject: "", query: "" });
  const [view, setView] = useState<{ state: "idle" | "loading" | "ready" | "error"; filter: Filters; cursors: string[]; index: number; data: Page | null }>({ state: "idle", filter: filters, cursors: [""], index: 0, data: null });
  const [expired, setExpired] = useState(false);
  const version = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const owner = useRef("");
  const invalidated = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);
  const selectionFocus = useRef(false);
  useEffect(() => () => { version.current += 1; controller.current?.abort(); }, []);
  useEffect(() => subscribeAccountSession(() => {
    if (!owner.current || invalidated.current || owner.current === authorization()) return;
    invalidated.current = true;
    version.current += 1;
    controller.current?.abort();
    onChange(null);
    setExpired(true);
    setOpen(false);
    setView(current => ({ ...current, data: null, state: "idle" }));
  }), [onChange]);
  useEffect(() => {
    if (view.state !== "loading" && returnFocus.current) { result.current?.focus(); returnFocus.current = false; }
    if (!open && selectionFocus.current) { trigger.current?.focus(); selectionFocus.current = false; }
  }, [view.state, open]);

  function cancel() { version.current += 1; controller.current?.abort(); }
  function edit(next: Filters) {
    cancel();
    setFilters(next);
    setView({ state: "idle", filter: next, cursors: [""], index: 0, data: null });
  }
  async function load(filter = filters, cursors = [""], index = 0, focus = false) {
    if (disabled || invalidated.current) return;
    cancel();
    const request = version.current;
    const auth = authorization();
    if (owner.current && auth !== owner.current) { setExpired(true); onChange(null); return; }
    owner.current = auth;
    const applied = { ...filter, query: filter.query.trim() };
    setFilters(applied);
    setOpen(true);
    returnFocus.current = focus;
    const release = index > 0 ? view.data?.release_id : undefined;
    setView({ state: "loading", filter: applied, cursors, index, data: null });
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 15_000);
    const current = () => request === version.current && auth === authorization();
    try {
      if (!auth || !process.env.NEXT_PUBLIC_API_URL) throw new Error("School account required");
      const query = new URLSearchParams({ year: String(applied.year), subject: applied.subject, q: applied.query, limit: "12" });
      if (cursors[index]) query.set("cursor", cursors[index]);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/school/curriculum/objectives?${query}`, { headers: { Authorization: auth }, cache: "no-store", signal: abort.signal });
      if (!response.ok) throw new Error("Catalogue unavailable");
      const data: unknown = await response.json();
      if (!current()) return;
      if (!validPage(data, applied, cursors, release)) throw new Error("Invalid catalogue page");
      setView({ state: "ready", filter: applied, cursors, index, data });
    } catch {
      if (current()) setView({ state: "error", filter: applied, cursors, index, data: null });
    } finally { clearTimeout(timeout); }
  }

  return <div className="p-5 text-sm text-[#42506b]">
    <p className="font-semibold text-[#17233f]">Learning objective</p>
    {value && <div className="my-3 rounded-lg border border-[#17233f]/15 bg-[#f7f0df] p-4" aria-live="polite">
      <p className="text-xs">Year {value.year} · {value.subject} · {value.strand}</p>
      <p className="mt-2 font-semibold text-[#17233f]">{value.statement}</p>
      {value.teacher_evidence && <p className="mt-2 leading-6">Evidence cue: {value.teacher_evidence}</p>}
    </div>}
    <button ref={trigger} type="button" className={`${button} mt-3`} disabled={disabled || expired} aria-expanded={open} aria-controls={id} onClick={() => { onChange(null); void load(); }}>{value ? "Change objective" : "Choose objective"}</button>
    {expired && <p role="alert" className="mt-3">Your school session changed. Sign out and sign in again.</p>}
    {open && <div id={id} className="mt-4 rounded-lg border border-[#17233f]/15">
      <form onSubmit={event => { event.preventDefault(); void load(filters, [""], 0, true); }}>
        <div className="grid sm:grid-cols-2">
          <LabeledSelect label="Curriculum year" value={String(filters.year)} values={["1", "2", "3", "4", "5", "6", "7"]} labels={Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i + 1), `Year ${i + 1}`]))} onChange={year => edit({ ...filters, year: Number(year) })} />
          <LabeledSelect label="Subject" value={filters.subject} values={["", ...subjects]} labels={{ "": "All three subjects" }} onChange={subject => edit({ ...filters, subject })} />
        </div>
        <label className="block px-5"><span className="font-semibold">Search objectives</span><input value={filters.query} maxLength={120} onChange={event => edit({ ...filters, query: event.target.value })} className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-[#17233f]/20 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7357c9]" /></label>
        <p className="px-5 pt-3 text-xs leading-5">Choose a year for this subject&apos;s learning or revision. This does not change the pupil&apos;s enrolled year or their access supports.</p>
        <div className="flex flex-wrap gap-2 p-5"><button type="submit" className={button}>Find objectives</button><button type="button" className={button} onClick={() => { cancel(); setOpen(false); selectionFocus.current = true; }}>Cancel search</button></div>
      </form>
      <div className="px-5 pb-5">
        <p ref={result} tabIndex={-1} role={view.state === "error" ? "alert" : view.state === "idle" ? undefined : "status"} className="leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7357c9]">
          {view.state === "idle" ? "Use Find objectives to apply these filters." : view.state === "loading" ? "Loading objectives…" : view.state === "error" ? "Objectives could not be loaded. No old choices are being shown." : view.data?.objectives.length ? `Page ${view.index + 1} · ${view.data.objectives.length} objectives${view.data.has_more ? " · more available" : " · end of results"}` : "No matching objectives. Try another year, subject or search."}
        </p>
        {view.state === "error" && <button className={`${button} mt-3`} type="button" onClick={() => void load(view.filter, view.cursors, view.index, true)}>Retry objectives</button>}
        <div className="mt-3 space-y-2">{view.data?.objectives.map(item => <button key={item.id} type="button" aria-label={`Choose ${item.statement}`} className={`${button} w-full text-left`} onClick={() => {
          if (owner.current !== authorization()) { setExpired(true); onChange(null); return; }
          cancel(); onChange(item); selectionFocus.current = true; setOpen(false);
        }}><span className="block text-xs font-normal text-[#42506b]">Year {item.year} · {item.subject} · {item.strand}</span><span className="mt-1 block break-words">{item.statement}</span></button>)}</div>
        {view.state === "ready" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} disabled={!view.index} onClick={() => void load(view.filter, view.cursors.slice(0, view.index), view.index - 1, true)}>Previous objectives</button><button type="button" className={button} disabled={!view.data?.has_more} onClick={() => void load(view.filter, [...view.cursors, view.data!.next_cursor], view.index + 1, true)}>Next objectives</button></div>}
      </div>
    </div>}
  </div>;
}
