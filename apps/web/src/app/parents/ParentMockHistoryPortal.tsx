"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import MockAssessmentBuilder from "@/components/MockAssessmentBuilder";
import MockAssessmentHistory from "@/components/MockAssessmentHistory";
import ProgressSnapshot from "@/components/ProgressSnapshot";
import { WorkspaceNavigation, WorkspaceSection, WorkspaceState } from "@/components/role-workspaces/WorkspaceNavigation";
import { accountSessionRole, getParentChildEvidence, getParentPortal, type ParentChildEvidence, type ParentPortal, type ProgressTopic } from "@/lib/api";

type LoadState = "inactive" | "checking" | "ready" | "error";
type EvidenceState = "idle" | "loading" | "ready" | "empty" | "error";

export default function ParentMockHistoryPortal() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [portal, setPortal] = useState<ParentPortal | null>(null);
  const [state, setState] = useState<LoadState>("inactive");
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<ParentChildEvidence | null>(null);
  const [evidenceState, setEvidenceState] = useState<EvidenceState>("idle");
  const [evidenceError, setEvidenceError] = useState("");

  useEffect(() => {
    if (accountSessionRole() !== "parent") return;
    let active = true;
    queueMicrotask(() => { if (active) setState("checking"); });
    getParentPortal()
      .then((loaded) => {
        if (!active) return;
        setPortal(loaded);
        setState("ready");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load the linked-child parent workspace.");
        setState("error");
      });
    return () => { active = false; };
  }, []);

  const requestedChild = searchParams.get("child") ?? "";
  const children = portal?.children ?? [];
  const linkedChild = children.find((item) => externalRefFor(item) === requestedChild);
  const scopedChild = linkedChild ?? children[0];
  const scopedChildRef = externalRefFor(scopedChild);

  useEffect(() => {
    if (state !== "ready" || !scopedChildRef || requestedChild === scopedChildRef) return;
    const canonical = new URLSearchParams(searchParams.toString());
    canonical.set("child", scopedChildRef);
    router.replace(`${pathname}?${canonical.toString()}`, { scroll: false });
  }, [pathname, requestedChild, router, scopedChildRef, searchParams, state]);

  useEffect(() => {
    if (!scopedChildRef || state !== "ready") return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setEvidence(null);
      setEvidenceError("");
      setEvidenceState("loading");
    });
    getParentChildEvidence(scopedChildRef)
      .then((loaded) => {
        if (!active) return;
        setEvidence(loaded);
        setEvidenceState(loaded.progress ? "ready" : "empty");
      })
      .catch((reason) => {
        if (!active) return;
        setEvidenceError(reason instanceof Error ? reason.message : "Progress evidence is unavailable.");
        setEvidenceState("error");
      });
    return () => { active = false; };
  }, [scopedChildRef, state]);

  if (state === "inactive") return null;
  if (state === "checking") return <WorkspaceState tone="loading">Loading linked-child history...</WorkspaceState>;
  if (state === "error") return <WorkspaceState tone="error">{error}</WorkspaceState>;

  if (children.length === 0) {
    return (
      <WorkspaceSection id="parent-children" eyebrow="Linked parent" title="No linked children yet" detail="Only children linked to this parent account can appear here.">
        <div className="p-5"><WorkspaceState>Ask the school or platform team to send a child-link invitation, or create a child from the family workspace.</WorkspaceState></div>
      </WorkspaceSection>
    );
  }

  const child = scopedChild;
  const childRef = scopedChildRef;
  const progress = evidence?.progress ?? null;

  function selectChild(nextChild: string) {
    if (!children.some((item) => externalRefFor(item) === nextChild)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("child", nextChild);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-8 grid gap-6" aria-label="Authenticated parent workspace">
      <WorkspaceNavigation
        label="Parent workspace sections"
        items={[
          { href: "#parent-child", label: "Linked child" },
          { href: "#parent-progress", label: "Learning picture" },
          { href: "#parent-priorities", label: "Strengths & practice" },
          { href: "#parent-access", label: "Access preferences" },
          { href: "#parent-mocks", label: "Subject checks" },
        ]}
      />

      <WorkspaceSection id="parent-child" eyebrow="Linked-parent workspace" title={`${child.student.display_name}'s learning workspace`} detail="Changing this selector changes every progress and subject-check request. Only children linked to this account are offered.">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="font-display text-xl font-semibold text-[#17233f]">Year {child.student.year_group} starting point</p>
            <p className="mt-2 text-sm leading-6 text-[#17233f]/62">Each subject advances on its own evidence. Earlier learning can return through spaced retrieval even after a subject moves ahead.</p>
          </div>
          <label className="min-w-64 text-xs font-semibold text-[#17233f]">
            Linked child
            <select value={childRef} onChange={(event) => selectChild(event.target.value)} className="mt-1 w-full rounded-lg border border-[#17233f]/14 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-[#7357c9]">
              {children.map((item) => {
                const externalRef = externalRefFor(item);
                return <option key={externalRef} value={externalRef}>{item.student.display_name} / Year {item.student.year_group}</option>;
              })}
            </select>
          </label>
        </div>
      </WorkspaceSection>

      <WorkspaceSection id="parent-progress" eyebrow="Progress by subject and year" title="Learning picture" detail="These are sampled curriculum signals, not labels or limits on what the child may learn next.">
        {evidenceState === "loading" ? <div className="p-5"><WorkspaceState tone="loading">Loading progress, strengths and practice priorities...</WorkspaceState></div> : null}
        {evidenceState === "error" ? <div className="p-5"><WorkspaceState tone="error">{evidenceError}</WorkspaceState></div> : null}
        {evidenceState === "empty" ? <div className="p-5"><WorkspaceState>No sampled progress is available yet. It will appear after learning evidence is stored.</WorkspaceState></div> : null}
        {evidenceState === "ready" ? <div className="[&_p]:!text-[#42506b]"><ProgressSnapshot progress={progress} tone="navy" empty="No sampled progress is available yet." /></div> : null}
      </WorkspaceSection>

      <WorkspaceSection id="parent-priorities" eyebrow="What to do next" title="Strengths and practice" detail="Celebrate secure learning and revisit practice areas without pressure. Mock scores remain separate from adaptive mastery.">
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <PriorityList title="Strengths to retain" topics={progress?.strengths ?? []} tone="strength" empty="Strengths will appear after varied evidence is collected." />
          <PriorityList title="Practise next" topics={progress?.practice ?? []} tone="practice" empty="No sampled practice priorities are available yet." />
        </div>
      </WorkspaceSection>

      <WorkspaceSection id="parent-access" eyebrow="SEND and access" title="How learning is presented" detail="These choices can change pacing, representation and controls. They never reduce curriculum entitlement or lower the evidence standard.">
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <AccessCard label="Audio" value={child.engagement.audio_support ? "On" : "Standard"} />
          <AccessCard label="Reading support" value={child.engagement.reading_support ? "On" : "Standard"} />
          <AccessCard label="Session" value={friendly(child.engagement.session_length)} />
          <AccessCard label="Sensory load" value={friendly(child.engagement.sensory_load)} />
          <AccessCard label="Support needs" value={child.engagement.declared_support_needs.map(friendly).join(", ") || "None declared"} wide />
          <AccessCard label="Learning approaches" value={child.engagement.learning_approaches.map(friendly).join(", ") || "Standard route"} wide />
        </div>
      </WorkspaceSection>

      <WorkspaceSection id="parent-mocks" eyebrow="Subject checks" title="Create and review sampled assessments" detail="A subject check is a snapshot for discussion and practice. It does not directly change the child's adaptive mastery or block progression.">
        <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.1fr]">
          <MockAssessmentBuilder key={`parent-workspace:${childRef}:${child.student.year_group}`} role="parent" studentId={childRef} studentName={child.student.display_name} yearGroup={child.student.year_group} />
          <MockAssessmentHistory role="parent" studentId={childRef} studentName={child.student.display_name} />
        </div>
      </WorkspaceSection>
    </div>
  );
}

function externalRefFor(child?: ParentPortal["children"][number]) {
  return child?.student.external_ref || child?.credential.student_external_ref || "";
}

function PriorityList({ title, topics, tone, empty }: { title: string; topics: ProgressTopic[]; tone: "strength" | "practice"; empty: string }) {
  return (
    <article className="rounded-xl border border-[#17233f]/10 bg-[#fbfaf6] p-4">
      <h3 className="font-display text-lg font-semibold text-[#17233f]">{title}</h3>
      {topics.length ? (
        <ul className="mt-3 grid gap-2">
          {topics.slice(0, 6).map((topic) => <li key={topic.objective_id} className="rounded-lg bg-white p-3 text-sm"><span aria-hidden="true" className={tone === "strength" ? "text-[#2c9b63]" : "text-[#d97919]"}>{tone === "strength" ? "✓ " : "• "}</span>{topic.topic || topic.statement}<span className="mt-1 block text-xs text-[#17233f]/52">Year {topic.year} · {topic.score}% sampled signal</span></li>)}
        </ul>
      ) : <p className="mt-3 text-sm leading-6 text-[#17233f]/58">{empty}</p>}
    </article>
  );
}

function AccessCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <article className={`rounded-xl border border-[#17233f]/10 bg-[#f7f0df] p-4 ${wide ? "sm:col-span-2" : ""}`}><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#596275]">{label}</p><p className="mt-2 text-sm font-semibold leading-6 text-[#17233f]">{value}</p></article>;
}

function friendly(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
