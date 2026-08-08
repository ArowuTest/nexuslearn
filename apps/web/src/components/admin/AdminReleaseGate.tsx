import type { AIReviewSummary } from "@/lib/admin-reviews";

export default function AdminReleaseGate({ summary }: { summary: AIReviewSummary }) {
  const pilotAllowed = summary.controlled_pilot_allowed;
  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Content release gates">
      <article className={`border p-5 ${pilotAllowed ? "border-[#4da66a]/30 bg-[#eefaf1]" : "border-[#d29a25]/35 bg-[#fff8e4]"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#565267]">Controlled pilot</p>
        <h3 className="mt-2 font-display text-2xl font-semibold">{pilotAllowed ? "Controlled pilot allowed" : "Controlled pilot blocked"}</h3>
        <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#1d1a3e]/70">
          <GateLine passed={summary.current_ai_curriculum_lead > 0} label={`${summary.current_ai_curriculum_lead.toLocaleString()} current AI Curriculum Lead decisions`} />
          <GateLine passed={summary.current_ai_send_lead > 0} label={`${summary.current_ai_send_lead.toLocaleString()} current AI SEND Lead decisions`} />
          <GateLine passed={summary.stale === 0} label={`${summary.stale.toLocaleString()} stale decisions`} />
          <GateLine passed={summary.revision_required === 0 && summary.escalation_required === 0} label={`${summary.revision_required} revisions and ${summary.escalation_required} escalations`} />
        </ul>
      </article>
      <article className="border border-[#cb5b5b]/25 bg-[#fff0f0] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#565267]">Public production</p>
        <h3 className="mt-2 font-display text-2xl font-semibold">Independent human gates still apply</h3>
        <p className="mt-3 text-sm leading-6 text-[#1d1a3e]/68">AI evidence can permit a controlled pilot. It can never replace the human evidence required for public use.</p>
        <ul className="mt-4 grid gap-2 text-sm leading-6 text-[#1d1a3e]/70">
          <GateLine passed={false} label="Independent human safeguarding approval" />
          <GateLine passed={false} label="Human listening approval for every required audio hash" />
          <GateLine passed={false} label="Recorded real-child pilot evidence" />
        </ul>
      </article>
    </section>
  );
}

function GateLine({ passed, label }: { passed: boolean; label: string }) {
  return <li className="flex gap-2"><span aria-hidden="true">{passed ? "✓" : "○"}</span><span>{label}</span></li>;
}
