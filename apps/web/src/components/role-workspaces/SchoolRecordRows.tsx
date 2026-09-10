"use client";

import { useRef, useState, type ReactNode } from "react";

// Presentation pagination over the bounded API response, never a claim that the
// complete historical archive has been fetched. Key by pupil and load state.
export default function SchoolRecordRows({ children, limitNote }: { children: ReactNode[]; limitNote?: string }) {
  const [page, setPage] = useState(0);
  const status = useRef<HTMLParagraphElement>(null);
  const last = Math.max(0, Math.ceil(children.length / 12) - 1);
  const current = Math.min(page, last);
  const start = current * 12;
  function change(next: number) { setPage(next); status.current?.focus(); }
  if (!children.length) return null;
  return <>
    {children.slice(start, start + 12)}
    {children.length > 12 && <div className="p-5 text-sm text-[#42506b]">
      <p ref={status} role="status" tabIndex={-1} aria-live="polite" className="rounded focus:outline focus:outline-2 focus:outline-[#7357c9]">Records {start + 1}–{Math.min(start + 12, children.length)} of {children.length} loaded</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button className="min-h-11 rounded-lg border border-[#7357c9] px-4 font-semibold disabled:opacity-50" disabled={current === 0} onClick={() => change(current - 1)}>Previous records</button>
        <button className="min-h-11 rounded-lg bg-[#ffbf45] px-4 font-semibold disabled:opacity-50" disabled={current === last} onClick={() => change(current + 1)}>Next records</button>
      </div>
    </div>}
    {limitNote && <p className="p-5 text-sm text-[#42506b]">{limitNote}</p>}
  </>;
}
