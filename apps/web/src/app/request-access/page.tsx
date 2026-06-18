"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { submitAccessRequest, type AccessRequest } from "@/lib/api";

const requestTypes = [
  { key: "school", label: "School", detail: "Classes, pupil IDs, teacher groups and evidence." },
  { key: "tutor_org", label: "Tutoring organisation", detail: "Cohorts, tutor groups and centre reporting." },
  { key: "parent", label: "Parent", detail: "Home access, child profiles and supported practice." },
] as const;

const yearOptions = [1, 2, 3, 4, 5, 6, 7];
const supportNeeds = [
  ["adhd", "ADHD"], ["autism", "Autism"], ["dyslexia", "Dyslexia"], ["dyscalculia", "Dyscalculia"],
  ["dyspraxia", "Dyspraxia"], ["speech_language", "Speech/language"], ["sensory", "Sensory sensitivity"],
  ["working_memory", "Working memory"], ["processing_speed", "Processing speed"], ["eal", "EAL"],
  ["hearing", "Hearing"], ["vision", "Vision"], ["anxiety_confidence", "Anxiety/confidence"],
  ["fine_motor", "Fine motor"], ["other", "Other"],
] as const;

const priorities = [
  ["predictable_routine", "Predictable routine"], ["short_bursts", "Short bursts"], ["visual_steps", "Visual steps"],
  ["audio_read_aloud", "Read aloud"], ["reduced_motion", "Reduced motion"], ["low_sensory", "Low sensory"],
  ["extra_processing_time", "Extra time"], ["worked_examples", "Worked examples"], ["confidence_first", "Confidence first"],
  ["movement_breaks", "Movement breaks"], ["teach_back", "Teach-back"], ["high_challenge", "High challenge"],
] as const;

const initialRequest: AccessRequest = {
  request_type: "school",
  organisation_name: "",
  contact_name: "",
  contact_email: "",
  phone: "",
  role: "",
  region: "",
  learner_count: 0,
  year_groups: [],
  support_needs: [],
  learning_priorities: [],
  message: "",
  source: "public_site",
};

export default function RequestAccessPage() {
  const [draft, setDraft] = useState<AccessRequest>(initialRequest);
  const [status, setStatus] = useState("Only contact name and email are required to begin.");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setStatus("Sending request...");
    try {
      if (!draft.contact_name.trim()) throw new Error("Contact name is required.");
      if (!draft.contact_email.trim()) throw new Error("Contact email is required.");
      if (draft.request_type !== "parent" && !draft.organisation_name.trim()) {
        throw new Error("Organisation name is required for schools and tutoring organisations.");
      }
      const saved = await submitAccessRequest({
        ...draft,
        contact_email: draft.contact_email.trim().toLowerCase(),
        learner_count: Number(draft.learner_count) || 0,
      });
      setStatus(`Request received. Reference ${saved.id ?? "created"} is in the review queue.`);
      setDraft(initialRequest);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send request.");
    } finally {
      setSaving(false);
    }
  }

  function toggleArray(field: "year_groups" | "support_needs" | "learning_priorities", value: number | string) {
    const current = draft[field] as Array<number | string>;
    const exists = current.includes(value);
    const next = exists ? current.filter((item) => item !== value) : [...current, value];
    setDraft({ ...draft, [field]: field === "year_groups" ? next.sort((a, b) => Number(a) - Number(b)) : next } as AccessRequest);
  }

  const activeType = requestTypes.find((item) => item.key === draft.request_type) ?? requestTypes[0];

  return (
    <main className="min-h-screen bg-[#121a35] text-white">
      <div className="mx-auto max-w-7xl px-5 py-5">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-semibold">NexusLearn</Link>
          <Link href="/" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">Home</Link>
        </nav>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.74fr_1.26fr]">
          <aside className="rounded-lg border border-white/10 bg-white/8 p-6">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">Access request</p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">Set up the right route from day one.</h1>
            <p className="mt-4 leading-7 text-white/72">
              Choose the route, share only the essential details, then optionally add Year groups and support needs so onboarding can be prepared properly.
            </p>
            <div className="mt-6 grid gap-3">
              {requestTypes.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setDraft({ ...draft, request_type: item.key, organisation_name: item.key === "parent" ? "" : draft.organisation_name })}
                  className={`rounded-lg border p-4 text-left transition ${draft.request_type === item.key ? "border-[#ffbf45] bg-[#ffbf45] text-[#17233f]" : "border-white/10 bg-white/8 text-white"}`}
                >
                  <span className="font-display text-lg font-semibold">{item.label}</span>
                  <span className="mt-1 block text-sm leading-5 opacity-72">{item.detail}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="overflow-hidden rounded-lg bg-white text-[#162244] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="border-b border-[#162244]/10 bg-[#f7f0df] p-6">
              <p className="font-display text-sm uppercase tracking-[0.16em] text-[#7357c9]">{activeType.label}</p>
              <h2 className="font-display mt-2 text-3xl font-semibold">Onboarding request</h2>
              <p className="mt-2 text-sm leading-6 text-[#162244]/66">{activeType.detail}</p>
            </div>

            <Section title="Essential contact">
              <div className="grid gap-4 md:grid-cols-2">
                {draft.request_type !== "parent" && <Field required label="Organisation name" value={draft.organisation_name} onChange={(organisation_name) => setDraft({ ...draft, organisation_name })} />}
                <Field required label="Contact name" value={draft.contact_name} onChange={(contact_name) => setDraft({ ...draft, contact_name })} />
                <Field required label="Contact email" value={draft.contact_email} onChange={(contact_email) => setDraft({ ...draft, contact_email })} />
                <Field label="Phone" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
                <Field label="Role" value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
                <Field label="Town, borough or region" value={draft.region} onChange={(region) => setDraft({ ...draft, region })} />
                <Field label="Estimated learners" type="number" value={draft.learner_count || ""} onChange={(learner_count) => setDraft({ ...draft, learner_count: Number(learner_count) || 0 })} />
              </div>
            </Section>

            <Section title="Learner profile">
              <ChoiceGroup title="Year groups" items={yearOptions.map((year) => [year, `Y${year}`] as const)} selected={draft.year_groups} onToggle={(value) => toggleArray("year_groups", value)} />
              <ChoiceGroup title="SEND/support needs" items={supportNeeds} selected={draft.support_needs} onToggle={(value) => toggleArray("support_needs", value)} />
              <ChoiceGroup title="Helpful learning approaches" items={priorities} selected={draft.learning_priorities} onToggle={(value) => toggleArray("learning_priorities", value)} />
            </Section>

            <Section title="Optional note">
              <textarea
                value={draft.message}
                onChange={(event) => setDraft({ ...draft, message: event.target.value })}
                rows={4}
                className="w-full resize-y rounded-lg border border-[#162244]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]"
                placeholder="Example: Year 3 maths confidence, phonics catch-up, low-sensory experience, homework evidence..."
              />
            </Section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#162244]/10 bg-[#fbfaf6] p-6">
              <p className="max-w-xl text-sm leading-6 text-[#162244]/64">{status}</p>
              <button onClick={submit} disabled={saving} className="btn-pop bg-[#ffbf45] px-6 py-4 text-[#162244] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Sending" : "Submit request"}
              </button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#162244]/10 p-6">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChoiceGroup({ title, items, selected, onToggle }: { title: string; items: readonly (readonly [string | number, string])[]; selected: Array<string | number>; onToggle: (value: string | number) => void }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-sm font-semibold text-[#162244]/70">{title} <span className="font-normal text-[#162244]/45">Optional</span></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(([value, label]) => (
          <button key={String(value)} onClick={() => onToggle(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${selected.includes(value) ? "bg-[#55cbd3] text-[#10233a]" : "bg-[#f6f3ea] text-[#162244]"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number"; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#162244]/70">
        {label} {!required && <span className="font-normal text-[#162244]/45">Optional</span>}
      </span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#162244]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}
