"use client";

import { useEffect, useState } from "react";
import MockAssessmentHistory from "@/components/MockAssessmentHistory";
import { accountSessionRole, getParentPortal, type ParentPortal } from "@/lib/api";

export default function ParentMockHistoryPortal() {
  const [portal, setPortal] = useState<ParentPortal | null>(null);
  const [selectedChild, setSelectedChild] = useState("");
  const [state, setState] = useState<"inactive" | "checking" | "ready" | "error">("inactive");
  const [error, setError] = useState("");

  useEffect(() => {
    if (accountSessionRole() !== "parent") {
      return;
    }

    let active = true;
    queueMicrotask(() => {
      if (active) setState("checking");
    });
    getParentPortal()
      .then((loaded) => {
        if (!active) return;
        const requestedChild = new URLSearchParams(window.location.search).get("child") ?? "";
        const linkedChild = loaded.children.find((item) => externalRefFor(item) === requestedChild);
        setPortal(loaded);
        setSelectedChild(externalRefFor(linkedChild ?? loaded.children[0]));
        setState("ready");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load the linked-child history portal.");
        setState("error");
      });
    return () => { active = false; };
  }, []);

  if (state === "inactive") return null;

  if (state === "checking") {
    return (
      <section className="mb-8 rounded-lg bg-white p-5 text-sm text-[#15213d]/68 shadow-card" role="status" aria-live="polite">
        Loading linked-child history...
      </section>
    );
  }

  if (state === "error") {
    return <section className="mb-8 rounded-lg border border-[#c65353]/20 bg-[#fff4f2] p-5 text-sm" role="alert">{error}</section>;
  }

  const children = portal?.children ?? [];
  if (children.length === 0) {
    return (
      <section className="mb-8 rounded-lg bg-white p-5 shadow-card">
        <h2 className="font-display text-xl font-semibold">Subject check history</h2>
        <p className="mt-2 text-sm text-[#15213d]/68">No linked children are available in this parent account.</p>
      </section>
    );
  }

  const child = children.find((item) => externalRefFor(item) === selectedChild) ?? children[0];
  const childRef = externalRefFor(child);
  return (
    <section className="mb-8 rounded-lg bg-white p-5 shadow-card" aria-label="Authenticated parent mock assessment history">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.16em] text-[#7357c9]">Linked-parent evidence</p>
          <p className="mt-1 text-sm text-[#15213d]/62">Choose a linked child to keep every history request within the authorised family scope.</p>
        </div>
        <label className="min-w-56 text-xs font-semibold">
          Linked child
          <select value={childRef} onChange={(event) => setSelectedChild(event.target.value)} className="mt-1 w-full rounded-lg border border-[#15213d]/14 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#7357c9]">
            {children.map((item) => {
              const externalRef = externalRefFor(item);
              return <option key={externalRef} value={externalRef}>{item.student.display_name} / Year {item.student.year_group}</option>;
            })}
          </select>
        </label>
      </div>
      <MockAssessmentHistory role="parent" studentId={childRef} studentName={child.student.display_name} />
    </section>
  );
}

function externalRefFor(child?: ParentPortal["children"][number]) {
  return child?.student.external_ref || child?.credential.student_external_ref || "";
}
