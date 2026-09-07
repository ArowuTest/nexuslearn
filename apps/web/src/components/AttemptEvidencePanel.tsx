import type { AttemptEvidence } from "@/lib/api";

// Adult workspaces only: do not mount this in the pupil's ProgressSnapshot.
export default function AttemptEvidencePanel({ items }: { items?: AttemptEvidence[] }) {
  if (!items?.length) return null;
  return (
    <section aria-label="Recent learning evidence" className="m-4 min-w-0 rounded-lg border border-[#15213d]/15 bg-white p-4 text-sm text-[#15213d]">
      <h3 className="font-display text-lg font-semibold">Recent learning evidence</h3>
      <p className="mt-2 leading-6">Latest {items.length} saved learning answers, newest first. Each result is evidence, not a mastery judgement. Subject checks are reported separately.</p>
      <p className="mt-2 text-xs leading-5">Submitted responses are saved input, not recordings or keystroke transcripts. Recorded answers are normalized for marking. Hints and response methods are context, not diagnoses or measures of effort.</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <details key={item.id} className="min-w-0 rounded-lg border border-[#15213d]/15 p-3">
            <summary className="cursor-pointer break-words py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              {item.correct ? "Answered correctly" : "Answer needs practice"} · {item.question_prompt || item.question_id}
            </summary>
            <dl className="mt-3 grid min-w-0 gap-3 break-words [overflow-wrap:anywhere]">
              {[
                ["Submitted response", item.submitted_response ? `${item.submitted_response.kind}: ${item.submitted_value_json ?? JSON.stringify(item.submitted_response.value)}` : "Original submission unavailable"],
                ["Recorded answer", item.recorded_answer || "No answer value recorded"],
                ["Grader revision", item.grader_revision || "Grader revision unavailable"],
                ["Support and response", `${item.independent ? "Independent" : "Supported; answer-revealing help recorded"} · ${item.assistance_used?.length ? item.assistance_used.join(", ") : item.hint_used ? "hint" : "No support recorded"} · ${item.response_mode || "Response method unavailable"} · ${item.format}`],
                ["Evidence score change", `${item.mastery_delta > 0 ? "+" : ""}${item.mastery_delta} points at this attempt. Progress also depends on varied, independent and retained evidence.`],
                ["Saved feedback", item.explanation || "No feedback recorded"],
                ["Question provenance", item.question_version ? `Frozen question version: ${item.question_version}` : "Historical record: question version unavailable. The current question is not substituted."],
                ["Evidence reference", `${item.id} · ${item.objective_id || "Objective unavailable"} · ${item.question_id}`],
                ["Recorded at", <time key="time" dateTime={item.attempted_at}>{item.attempted_at.replace("T", " ").replace("Z", " UTC")}</time>],
              ].map(([label, value]) => <div key={String(label)}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap">{value}</dd></div>)}
            </dl>
          </details>
        ))}
      </div>
    </section>
  );
}
