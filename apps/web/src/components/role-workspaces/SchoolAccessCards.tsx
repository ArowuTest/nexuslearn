"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { accountSessionHeaders, subscribeAccountSession } from "@/lib/api";
import { LabeledSelect, LoginCard, Panel } from "./SchoolWorkspacePrimitives";
import { classYearLabel } from "./useSchoolDirectories";

type Credential = { student_external_ref: string; display_name?: string; login_code: string; picture_password: string[]; qr_secret_hash?: string };
type CardPage = { class_id: string; student_credentials: Credential[]; limit: number; has_more: boolean; next_cursor: string };
type ClassSummary = { id?: string; name: string; year_group: number };
const ready = (card: Credential) => Boolean(card.login_code || card.picture_password.length || card.qr_secret_hash);
const schoolAuthorization = () => accountSessionHeaders(["school_admin", "teacher"]).Authorization ?? "";

function validPage(value: unknown, classID: string, cursors: string[]): value is CardPage {
  const page = value as CardPage;
  return !!page && page.class_id === classID && page.limit === 12 && typeof page.has_more === "boolean"
    && typeof page.next_cursor === "string" && (!page.has_more || !!page.next_cursor && !cursors.includes(page.next_cursor))
    && Array.isArray(page.student_credentials) && page.student_credentials.length <= 12
    && page.student_credentials.every(card => card && typeof card.student_external_ref === "string" && !!card.student_external_ref
      && typeof card.login_code === "string" && (card.picture_password == null || Array.isArray(card.picture_password) && card.picture_password.every(p => typeof p === "string"))
      && (card.display_name == null || typeof card.display_name === "string") && (card.qr_secret_hash == null || typeof card.qr_secret_hash === "string"))
    && new Set(page.student_credentials.map(card => card.student_external_ref)).size === page.student_credentials.length;
}

export default function SchoolAccessCards({ classes, schoolName, loadPage, onClassChange }: {
  classes: ClassSummary[]; schoolName: string; loadPage: (classID: string, cursor: string) => Promise<unknown>; onClassChange?: (classID: string) => void;
}) {
  const [view, setView] = useState<{ classID: string; cursors: string[]; index: number; data: CardPage | null; authorization: string; sessionChanged?: boolean; state: "idle" | "loading" | "ready" | "error" }>({ classID: "", cursors: [""], index: 0, data: null, authorization: "", state: "idle" });
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState("");
  const [printQueue, setPrintQueue] = useState<{ className: string; cards: Credential[]; authorization: string } | null>(null);
  const request = useRef(0);
  const result = useRef<HTMLParagraphElement>(null);
  const focusResult = useRef(false);
  useEffect(() => () => { request.current += 1; }, []);
  const invalidateSession = useCallback(() => {
    request.current += 1;
    setSelected([]);
    setExpanded("");
    setPrintQueue(null);
    setView(current => ({ ...current, data: null, authorization: "", state: "error", sessionChanged: true }));
  }, []);
  useEffect(() => {
    if (!view.authorization) return;
    return subscribeAccountSession(() => {
      if (schoolAuthorization() !== view.authorization) invalidateSession();
    });
  }, [view.authorization, invalidateSession]);
  useEffect(() => {
    if (view.state !== "loading" && focusResult.current) {
      result.current?.focus();
      focusResult.current = false;
    }
  }, [view.state]);
  function guardSession() {
    if (view.authorization && view.authorization === schoolAuthorization()) return true;
    invalidateSession();
    return false;
  }

  useEffect(() => {
    if (!printQueue) return;
    const finish = () => setPrintQueue(null);
    window.addEventListener("afterprint", finish);
    // Wait for the selected sheet to commit, never print a stale school session.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (printQueue.authorization && schoolAuthorization() === printQueue.authorization) window.print();
        else invalidateSession();
      });
    });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("afterprint", finish); };
  }, [printQueue, invalidateSession]);

  async function load(classID: string, cursors = [""], index = 0, returnFocus = false) {
    if (view.sessionChanged || view.authorization && !guardSession()) return;
    const authorization = schoolAuthorization();
    const version = ++request.current;
    focusResult.current = returnFocus;
    setSelected([]);
    setExpanded("");
    setPrintQueue(null);
    if (!classes.some(item => item.id === classID)) {
      setView({ classID: "", cursors: [""], index: 0, data: null, authorization, state: "idle" });
      return;
    }
    setView({ classID, cursors, index, data: null, authorization, state: "loading" });
    const current = () => version === request.current && authorization === schoolAuthorization();
    try {
      if (!authorization) throw new Error("School session required");
      const data = await loadPage(classID, cursors[index]);
      if (!current()) return;
      if (!validPage(data, classID, cursors)) throw new Error("Invalid card page");
      const normalized = { ...data, student_credentials: data.student_credentials.map(card => ({ ...card, picture_password: card.picture_password ?? [] })) };
      setView({ classID, cursors, index, data: normalized, authorization, state: "ready" });
    } catch {
      if (current()) setView({ classID, cursors, index, data: null, authorization, state: "error" });
    }
  }

  const activeClass = classes.find(item => item.id === view.classID);
  const cards = activeClass ? view.data?.student_credentials ?? [] : [];
  const printable = cards.filter(card => ready(card) && selected.includes(card.student_external_ref));
  const button = "min-h-11 rounded-lg border border-[#17233f]/20 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7357c9]";
  return <>
    <Panel id="school-access" title="Pupil Login Packs" accessibleName="Pupil Login Packs">
      <p className="p-5 text-sm leading-6 text-[#42506b]">Choose one class. Cards load 12 at a time and stay hidden until opened. Print only the pupils you select on this page; keep their cards with trusted adults.</p>
      <fieldset disabled={view.sessionChanged}><LabeledSelect label="Login card class" value={view.classID} values={["", ...classes.map(item => item.id ?? "").filter(Boolean)]} labels={Object.fromEntries(classes.map(item => [item.id ?? "", `${item.name} (${classYearLabel(item.year_group)})`]))} onChange={id => { onClassChange?.(id); void load(id); }} /></fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p ref={result} tabIndex={-1} role={view.state === "idle" ? undefined : view.state === "error" ? "alert" : "status"} className="text-sm text-[#42506b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7357c9]">
          {view.sessionChanged ? "Your school session changed or expired. Sign out and sign in again before loading login cards." : view.state === "idle" ? "Choose a class to see its login cards." : view.state === "loading" ? "Loading class cards…" : view.state === "error" ? "This class's cards could not be loaded. No old cards are being shown." : `Page ${view.index + 1} · ${cards.length} ${cards.length === 1 ? "pupil" : "pupils"}${view.data?.has_more ? " · more available" : " · end of class"}`}
        </p>
        {view.state === "error" && !view.sessionChanged && <button className={button} onClick={() => void load(view.classID, view.cursors, view.index, true)}>Retry card page</button>}
        {view.state === "ready" && <div className="flex flex-wrap gap-2">
          <button className={button} disabled={view.index === 0} onClick={() => void load(view.classID, view.cursors.slice(0, view.index), view.index - 1, true)}>Previous page</button>
          <button className={button} disabled={!view.data?.has_more} onClick={() => void load(view.classID, [...view.cursors, view.data!.next_cursor], view.index + 1, true)}>Next page</button>
        </div>}
      </div>
      {view.state === "ready" && <div className="flex flex-wrap gap-3 p-5">
        <button className={button} disabled={!cards.some(ready)} onClick={() => { if (guardSession()) setSelected(cards.filter(ready).map(card => card.student_external_ref)); }}>Select this page</button>
        <button className={button} disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</button>
        <button className={`${button} !bg-[#17233f] text-white`} disabled={!printable.length} onClick={() => {
          if (guardSession()) setPrintQueue({ className: activeClass!.name, cards: printable, authorization: view.authorization });
        }}>Print selected cards ({printable.length})</button>
      </div>}
      {cards.map(card => {
        const id = card.student_external_ref;
        const name = card.display_name || id;
        return <div key={id} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-h-11 min-w-0 items-center gap-3 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#7357c9]" aria-label={`Print ${name} (${id})`} disabled={!ready(card)} checked={selected.includes(id)} onChange={e => { if (guardSession()) setSelected(e.target.checked ? [...selected, id] : selected.filter(item => item !== id)); }} />
              <span className="break-words">{name}<span className="block text-xs font-normal text-[#42506b]">{ready(card) ? "Login ready" : "Not generated"}</span></span>
            </label>
            {ready(card) && <button className={button} aria-expanded={expanded === id} aria-controls={`card-${id}`} aria-label={`${expanded === id ? "Hide" : "Show"} login card for ${name}`} onClick={() => { if (guardSession()) setExpanded(expanded === id ? "" : id); }}>{expanded === id ? "Hide card" : "Show card"}</button>}
          </div>
          <div id={`card-${id}`} className={expanded === id ? "mt-4" : undefined}>{expanded === id && <LoginCard credential={card} schoolName={schoolName} />}</div>
        </div>;
      })}
      {view.state === "ready" && cards.length === 0 && <p className="p-5 text-sm text-[#42506b]">This class has no pupils yet. Add pupils in Classes &amp; pupils, then generate their logins.</p>}
    </Panel>
    <section className="print-card-sheet hidden">
      <h2 className="mb-2 font-display text-2xl font-semibold">NexusLearn pupil login cards</h2>
      <p className="mb-5 text-sm">{printQueue ? `${schoolName} · ${printQueue.className} · ${printQueue.cards.length} selected` : "No cards selected for printing. Use Print selected cards in the school workspace."}</p>
      <div className="grid gap-4 sm:grid-cols-2">{printQueue?.cards.map(card => <LoginCard key={card.student_external_ref} credential={card} schoolName={schoolName} />)}</div>
    </section>
  </>;
}
