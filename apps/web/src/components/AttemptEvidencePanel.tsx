import type { AttemptEvidence } from "@/lib/api";

// Adult workspaces only: do not mount this in the pupil's ProgressSnapshot.
export default function AttemptEvidencePanel({ items }: { items?: AttemptEvidence[] }) {
  if (!items?.length) return null;
  return (
    <section aria-label="Recent learning evidence" className="m-4 min-w-0 rounded-lg border border-[#15213d]/15 bg-white p-4 text-sm text-[#15213d]">
      <h3 className="font-display text-lg font-semibold">Recent learning evidence</h3>
      <p className="mt-2 leading-6">Latest {items.length} saved learning answers, newest first. Each result is evidence, not a mastery judgement. Subject checks are reported separately.</p>
      <p className="mt-2 text-xs leading-5">Answers below are the normalized values used for marking, not verbatim transcripts. Hints and response methods provide context; they are not diagnoses or measures of effort.</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <details key={item.id} className="min-w-0 rounded-lg border border-[#15213d]/15 p-3">
            <summary className="cursor-pointer break-words py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              {item.correct ? "Answered correctly" : "Answer needs practice"} · {item.question_prompt || item.question_id}
            </summary>
            <dl className="mt-3 grid min-w-0 gap-3 break-words">
              <div><dt className="font-semibold">Recorded answer</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.recorded_answer || "No answer value recorded"}</dd></div>
              <div><dt className="font-semibold">Support and response</dt><dd>{item.hint_used ? "Hint used" : "No hint recorded"} · {item.response_mode || "Response method unavailable"} · {item.format}</dd></div>
              <div><dt className="font-semibold">Evidence score change</dt><dd>{item.mastery_delta > 0 ? "+" : ""}{item.mastery_delta} points at this attempt. Progress also depends on varied, independent and retained evidence.</dd></div>
              <div><dt className="font-semibold">Saved feedback</dt><dd>{item.explanation || "No feedback recorded"}</dd></div>
              <div><dt className="font-semibold">Question provenance</dt><dd>{item.question_version ? <>Frozen question version: <code className="[overflow-wrap:anywhere]">{item.question_version}</code></> : "Historical record: question version unavailable. The current question is not substituted."}</dd></div>
              <div><dt className="font-semibold">Evidence reference</dt><dd className="[overflow-wrap:anywhere]">{item.id} · {item.objective_id || "Objective unavailable"} · {item.question_id}</dd></div>
              <div><dt className="font-semibold">Recorded at</dt><dd><time dateTime={item.attempted_at}>{item.attempted_at.replace("T", " ").replace("Z", " UTC")}</time></dd></div>
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
