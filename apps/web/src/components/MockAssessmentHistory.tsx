"use client";

import { useEffect, useRef, useState } from "react";
import MockObjectiveGuidance from "@/components/MockObjectiveGuidance";
import {
  getParentMockAssessmentPage,
  getSchoolMockAssessmentPage,
  type MockAssessmentHistoryPage,
  type MockAssessmentPageOptions,
  type ParentMockAssessmentHistoryEntry,
} from "@/lib/api";

type HistoryRole = "parent" | "school";
type LoadState = "idle" | "loading" | "ready" | "error";

export default function MockAssessmentHistory({
  role,
  studentId,
  studentName,
}: {
  role: HistoryRole;
  studentId: string;
  studentName: string;
}) {
  const [subject, setSubject] = useState<"" | NonNullable<MockAssessmentPageOptions["subject"]>>("");
  const [status, setStatus] = useState<"" | NonNullable<MockAssessmentPageOptions["status"]>>("");
  const [assessments, setAssessments] = useState<ParentMockAssessmentHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const requestVersion = useRef(0);
  const pendingFirstPage = useRef<{ key: string; request: Promise<MockAssessmentHistoryPage> } | null>(null);

  useEffect(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    queueMicrotask(() => {
      if (requestVersion.current !== version) return;
      setAssessments([]);
      setNextCursor("");
      setError("");
      setLoadState(studentId ? "loading" : "idle");
    });
    if (!studentId) {
      return;
    }

    const requestKey = `${role}:${studentId}:${subject}:${status}:${retryVersion}`;
    const request = pendingFirstPage.current?.key === requestKey
      ? pendingFirstPage.current.request
      : loadPage(role, studentId, { limit: 20, subject: subject || undefined, status: status || undefined });
    pendingFirstPage.current = { key: requestKey, request };
    const clearPendingRequest = () => {
      if (pendingFirstPage.current?.request === request) pendingFirstPage.current = null;
    };
    request
      .then((page) => {
        clearPendingRequest();
        if (requestVersion.current !== version) return;
        setAssessments(uniqueAssessments([], page.mock_assessments));
        setNextCursor(page.next_cursor ?? "");
        setLoadState("ready");
      })
      .catch((reason) => {
        clearPendingRequest();
        if (requestVersion.current !== version) return;
        setError(reason instanceof Error ? reason.message : "Could not load subject check history.");
        setLoadState("error");
      });
  }, [retryVersion, role, status, studentId, subject]);

  async function loadOlder() {
    if (!nextCursor || loadState === "loading") return;
    const version = requestVersion.current;
    setLoadState("loading");
    setError("");
    try {
      const page = await loadPage(role, studentId, {
        cursor: nextCursor,
        limit: 20,
        subject: subject || undefined,
        status: status || undefined,
      });
      if (requestVersion.current !== version) return;
      setAssessments((current) => uniqueAssessments(current, page.mock_assessments));
      setNextCursor(page.next_cursor ?? "");
      setLoadState("ready");
    } catch (reason) {
      if (requestVersion.current !== version) return;
      setError(reason instanceof Error ? reason.message : "Could not load older subject checks.");
      setLoadState("error");
    }
  }

  return (
    <section className="rounded-lg border border-[#7357c9]/18 bg-[#fbfaf6] p-4 text-[#15213d]" aria-labelledby={`mock-history-${role}-${studentId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`mock-history-${role}-${studentId}`} className="font-display text-xl font-semibold">Subject check history</h2>
          <p className="mt-1 text-sm leading-6 text-[#15213d]/68">
            For {studentName}. These checks sample selected curriculum objectives and support revision decisions. This sampled evidence does not change adaptive mastery.
          </p>
        </div>
        <span className="rounded-full bg-[#55cbd3]/18 px-3 py-1 text-xs font-semibold text-[#155d64]">Sampled evidence</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">
          History subject
          <select
            value={subject}
            onChange={(event) => setSubject(event.target.value as typeof subject)}
            className="mt-1 w-full rounded-lg border border-[#15213d]/14 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#7357c9]"
          >
            <option value="">All subjects</option>
            <option value="English">English</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Science">Science</option>
          </select>
        </label>
        <label className="text-xs font-semibold">
          History status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="mt-1 w-full rounded-lg border border-[#15213d]/14 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#7357c9]"
          >
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <div className="mt-4" aria-live="polite" aria-busy={loadState === "loading"}>
        {loadState === "loading" && assessments.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-[#15213d]/68">Loading subject check history...</p>
        )}

        {loadState === "error" && assessments.length === 0 && (
          <div className="rounded-lg border border-[#c65353]/20 bg-[#fff4f2] p-4 text-sm">
            <p>{error || "Subject check history is unavailable."}</p>
            <button onClick={() => setRetryVersion((value) => value + 1)} className="mt-3 rounded-lg bg-[#15213d] px-4 py-2 text-xs font-semibold text-white">Try again</button>
          </div>
        )}

        {loadState === "ready" && assessments.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-[#15213d]/68">No subject checks match this learner and these filters yet.</p>
        )}

        {assessments.length > 0 && (
          <div className="grid gap-3">
            {assessments.map((assessment) => <AssessmentRow key={assessment.id} assessment={assessment} />)}
          </div>
        )}

        {error && assessments.length > 0 && (
          <p className="mt-3 rounded-lg border border-[#c65353]/20 bg-[#fff4f2] p-3 text-sm">{error} Your loaded checks are still shown.</p>
        )}

        {nextCursor && (
          <button onClick={loadOlder} disabled={loadState === "loading"} className="mt-4 rounded-lg bg-[#7357c9] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {loadState === "loading" ? "Loading older checks..." : "Load older checks"}
          </button>
        )}

        {loadState === "ready" && assessments.length > 0 && !nextCursor && (
          <p className="mt-4 text-sm text-[#15213d]/58">You have reached the end of this history.</p>
        )}
      </div>
    </section>
  );
}

function AssessmentRow({ assessment }: { assessment: ParentMockAssessmentHistoryEntry }) {
  const completed = assessment.status === "completed";
  return (
    <article className="rounded-lg border border-[#15213d]/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold">{assessment.title}</h3>
          <p className="mt-1 text-xs text-[#15213d]/58">{assessment.subject} · Target Year {assessment.year_group}</p>
        </div>
        <span className="rounded-full bg-[#f3efff] px-3 py-1 text-xs font-semibold text-[#5a3ca8]">{statusLabel(assessment.status)}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#15213d]/68">
        {completed
          ? `Sampled score: ${assessment.score}% · ${assessment.correct_count}/${assessment.question_count} correct.`
          : `Progress saved: ${assessment.answered_count}/${assessment.question_count} questions answered.`}
      </p>
      {assessment.created_at && <p className="mt-1 text-xs text-[#15213d]/48">Created {new Date(assessment.created_at).toLocaleDateString()}</p>}
      {completed && assessment.objective_results?.length > 0 ? (
        <details className="mt-3 border-t border-[#15213d]/10 pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-[#5a3ca8]">Open sampled objective detail</summary>
          <MockObjectiveGuidance results={assessment.objective_results} compact />
        </details>
      ) : (
        <p className="mt-3 border-t border-[#15213d]/10 pt-3 text-xs leading-5 text-[#15213d]/58">
          {completed
            ? "Objective detail is not available for this check. The score remains sampled evidence only."
            : assessment.status === "cancelled"
              ? "This check is closed and cannot be resumed."
              : "The learner can open this check from their signed-in profile."}
        </p>
      )}
    </article>
  );
}

function uniqueAssessments(current: ParentMockAssessmentHistoryEntry[], incoming: ParentMockAssessmentHistoryEntry[]) {
  const byID = new Map(current.map((assessment) => [assessment.id, assessment]));
  incoming.forEach((assessment) => byID.set(assessment.id, assessment));
  return Array.from(byID.values());
}

function loadPage(role: HistoryRole, studentId: string, options: MockAssessmentPageOptions) {
  return role === "parent"
    ? getParentMockAssessmentPage(studentId, options)
    : getSchoolMockAssessmentPage(studentId, options);
}

function statusLabel(status: ParentMockAssessmentHistoryEntry["status"]) {
  switch (status) {
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return "Ready";
  }
}
