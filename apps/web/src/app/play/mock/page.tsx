"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChildJourneyChrome, { ApiStateCard } from "@/components/ChildJourneyChrome";
import MockAssessmentBuilder from "@/components/MockAssessmentBuilder";
import { getPupilMockAssessments, getStudentProfile, type MockAssessment } from "@/lib/api";

export default function PupilMockPage() {
  const [studentId, setStudentId] = useState("");
  const [yearGroup, setYearGroup] = useState(1);
  const [assessments, setAssessments] = useState<MockAssessment[]>([]);
  const [assessmentState, setAssessmentState] = useState<"loading" | "ready" | "unavailable">("loading");
  useEffect(() => {
    const queryStudent = new URLSearchParams(window.location.search).get("studentId");
    const storedStudent = sessionStorage.getItem("nexuslearn_pupil_id") || "";
    const resolvedStudent = queryStudent || storedStudent;
    setStudentId(resolvedStudent);
    if (!resolvedStudent) {
      setAssessmentState("ready");
      return;
    }
    void Promise.allSettled([
      getStudentProfile(resolvedStudent),
      getPupilMockAssessments(resolvedStudent),
    ]).then(([profileResult, assessmentResult]) => {
      if (profileResult.status === "fulfilled" && profileResult.value?.year_group) setYearGroup(profileResult.value.year_group);
      if (assessmentResult.status === "fulfilled") {
        setAssessments(assessmentResult.value);
        setAssessmentState("ready");
      } else {
        setAssessmentState("unavailable");
      }
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#111a33] px-5 py-6 text-white">
      <div className="mx-auto max-w-4xl">
        <ChildJourneyChrome
          active="practise"
          context={studentId ? `Year ${yearGroup} subject check` : "Sign in to build a private subject check"}
          backHref={studentId ? `/play/mission?studentId=${encodeURIComponent(studentId)}` : "/login"}
          backLabel="Back to learning"
        />
        <section className="mt-10 rounded-lg bg-white p-6 text-[#15213d] shadow-[0_24px_70px_rgba(0,0,0,0.25)] md:p-8">
          <p className="font-display text-xs uppercase tracking-[0.16em] text-[#7357c9]">Practice studio</p>
          <h1 className="font-display mt-2 text-4xl font-semibold">Build a subject check.</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#15213d]/65">Choose what you want to practise. The platform keeps your learning supports, mixes retrieval with fresh evidence and never turns a mock into a speed penalty.</p>
          <div className="mt-6">
            {studentId ? <MockAssessmentBuilder role="pupil" studentId={studentId} yearGroup={yearGroup} onCreated={(assessment) => setAssessments((items) => [assessment, ...items.filter((item) => item.id !== assessment.id)])} /> : (
              <div className="rounded-lg border border-[#d97919]/25 bg-[#fff7e7] p-5 text-sm leading-6 text-[#6a4a00]">Sign in with your pupil learning card first. Your session keeps this builder private to you. <Link href="/login" className="font-semibold underline">Open pupil login</Link>.</div>
            )}
          </div>
          {studentId && assessments.length > 0 && (
            <section className="mt-6 rounded-lg border border-[#15213d]/10 bg-[#f7f0df] p-5" aria-label="Ready mock assessments">
              <h2 className="font-display text-xl font-semibold">Ready checks</h2>
              <div className="mt-3 grid gap-2">
                {assessments.map((assessment) => (
                  <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3">
                    <div>
                      <p className="font-semibold">{assessment.title}</p>
                      <p className="mt-1 text-xs text-[#15213d]/58">{assessment.subject} · Y{assessment.year_from}{assessment.year_to !== assessment.year_from ? `–Y${assessment.year_to}` : ""} · {assessment.question_count} questions</p>
                    </div>
                    <Link href={`/play/mission?studentId=${encodeURIComponent(studentId)}&mockAssessmentId=${encodeURIComponent(assessment.id)}`} className="rounded-lg bg-[#7357c9] px-4 py-2 text-xs font-semibold text-white">Open check</Link>
                  </div>
                ))}
              </div>
            </section>
          )}
          {studentId && assessmentState === "loading" && (
            <div className="mt-6">
              <ApiStateCard kind="loading" title="Loading your saved checks" body="Your previous subject checks are being fetched before you create another one." />
            </div>
          )}
          {studentId && assessmentState === "unavailable" && (
            <div className="mt-6">
              <ApiStateCard kind="unavailable" title="Saved checks are unavailable" body="The practice service did not return your saved checks. You can return to learning and try again later; no empty list is being presented as if it were complete." />
            </div>
          )}
          {studentId && assessmentState === "ready" && assessments.length === 0 && (
            <div className="mt-6">
              <ApiStateCard kind="empty" title="No saved checks yet" body="Create a subject check above when you want a focused retrieval or stretch session." />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
