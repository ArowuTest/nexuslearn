"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  createParentMockAssessment,
  createPupilMockAssessment,
  createSchoolMockAssessment,
  type MockAssessment,
  type MockAssessmentRequest,
} from "@/lib/api";

type MockRole = "pupil" | "parent" | "school";

export default function MockAssessmentBuilder({
  role,
  studentId,
  studentName,
  yearGroup,
  onCreated,
}: {
  role: MockRole;
  studentId: string;
  studentName?: string;
  yearGroup: number;
  onCreated?: (assessment: MockAssessment) => void;
}) {
  const [subject, setSubject] = useState<MockAssessmentRequest["subject"]>("Mathematics");
  const [year, setYear] = useState(Math.min(7, Math.max(1, yearGroup || 1)));
  const [questionCount, setQuestionCount] = useState(10);
  const [includeRevision, setIncludeRevision] = useState(true);
  const [includeStretch, setIncludeStretch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Choose a subject check. It will use approved questions and keep SEND supports active.");
  const [created, setCreated] = useState<MockAssessment | null>(null);
  const requestKey = useRef({ fingerprint: "", value: "" });
  const [createdRequestFingerprint, setCreatedRequestFingerprint] = useState("");

  const currentFingerprint = JSON.stringify({ role, studentId, subject, year, questionCount, includeRevision, includeStretch });

  async function generate() {
    if (!studentId) {
      setMessage("Choose or load a learner before generating a mock.");
      return;
    }
    setSaving(true);
    setMessage("Building a balanced subject check...");
    try {
      const fingerprint = currentFingerprint;
      if (requestKey.current.fingerprint !== fingerprint || !requestKey.current.value) {
        requestKey.current = {
          fingerprint,
          value: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        };
      }
      const request: MockAssessmentRequest = {
        subject,
        year_group: year,
        question_count: questionCount,
        include_revision: includeRevision,
        include_stretch: includeStretch,
        accessibility: { generated_from: role === "pupil" ? "pupil" : "adult_support_profile" },
        idempotency_key: requestKey.current.value,
      };
      const assessment = role === "pupil"
        ? await createPupilMockAssessment(studentId, request)
        : role === "parent"
          ? await createParentMockAssessment(studentId, request)
          : await createSchoolMockAssessment(studentId, request);
      setCreated(assessment);
      setCreatedRequestFingerprint(fingerprint);
      onCreated?.(assessment);
      setMessage(`${assessment.title} is ready with ${assessment.question_count} approved questions.`);
      requestKey.current = { fingerprint: "", value: "" };
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The mock could not be generated.");
    } finally {
      setSaving(false);
    }
  }

  const hasCurrentAssessment = Boolean(created && createdRequestFingerprint === currentFingerprint);
  const launchHref = hasCurrentAssessment && created ? `/play/mission?studentId=${encodeURIComponent(studentId)}&mockAssessmentId=${encodeURIComponent(created.id)}` : "";
  return (
    <section className="rounded-lg border border-[#7357c9]/18 bg-[#fbfaf6] p-4 text-[#15213d]" aria-label="Generate a mock assessment">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-semibold">Subject mock assessment</p>
          <p className="mt-1 text-xs leading-5 text-[#15213d]/62">
            {studentName ? `For ${studentName}. ` : ""}Balanced across objectives, with optional revision and stretch evidence.
          </p>
        </div>
        <span className="rounded-full bg-[#8be28f]/30 px-3 py-1 text-[0.68rem] font-semibold text-[#215d26]">SEND-safe by design</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold">
          Subject
          <select value={subject} onChange={(event) => setSubject(event.target.value as MockAssessmentRequest["subject"])} className="mt-1 w-full rounded-lg border border-[#15213d]/14 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#7357c9]">
            <option>Mathematics</option>
            <option>English</option>
            <option>Science</option>
          </select>
        </label>
        <label className="text-xs font-semibold">
          Target year
          <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#15213d]/14 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#7357c9]">
            {Array.from({ length: 7 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>Year {value}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Questions
          <select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#15213d]/14 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#7357c9]">
            {[5, 10, 15, 20, 30].map((value) => <option key={value} value={value}>{value} questions</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeRevision} onChange={(event) => setIncludeRevision(event.target.checked)} className="accent-[#7357c9]" /> Include earlier-year retrieval</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeStretch} onChange={(event) => setIncludeStretch(event.target.checked)} className="accent-[#7357c9]" /> Include next-year stretch</label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-[#15213d]/62" aria-live="polite">{message}</p>
        <div className="flex flex-wrap gap-2">
          {hasCurrentAssessment && role === "pupil" && <Link href={launchHref} className="rounded-lg bg-[#55cbd3] px-4 py-2 text-xs font-semibold text-[#15213d]">Start mock</Link>}
          <button onClick={generate} disabled={saving || !studentId} className="btn-pop bg-[#7357c9] px-4 py-2 text-xs text-white disabled:opacity-50">{saving ? "Building..." : "Generate mock"}</button>
        </div>
      </div>
      {hasCurrentAssessment && created && role !== "pupil" && <p className="mt-2 rounded-lg bg-white p-3 text-xs leading-5 text-[#15213d]/68">Assessment ID: <code>{created.id}</code>. The pupil can open it after signing in with their usual access card.</p>}
    </section>
  );
}
