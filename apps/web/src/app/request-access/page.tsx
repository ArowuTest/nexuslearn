"use client";

import Link from "next/link";
import { useState } from "react";
import { submitAccessRequest, type AccessRequest } from "@/lib/api";

const requestTypes = [
  { key: "school", label: "School", detail: "Whole-school setup, classes, pupil IDs and teacher groups." },
  { key: "tutor_org", label: "Tutoring organisation", detail: "Cohorts, tutor groups and progress evidence across centres." },
  { key: "parent", label: "Parent", detail: "Home access, child progress evidence and supported practice." },
] as const;

const yearOptions = [1, 2, 3, 4, 5, 6, 7];

const initialRequest: AccessRequest = {
  request_type: "school",
  organisation_name: "",
  contact_name: "",
  contact_email: "",
  phone: "",
  role: "",
  region: "",
  learner_count: 30,
  year_groups: [1, 2, 3, 4, 5, 6, 7],
  message: "",
  source: "public_site",
};

export default function RequestAccessPage() {
  const [draft, setDraft] = useState<AccessRequest>(initialRequest);
  const [status, setStatus] = useState("Tell us who you are setting NexusLearn up for.");
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
      setStatus(`Request received. Reference ${saved.id ?? "created"} is now in the admin review queue.`);
      setDraft(initialRequest);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send request.");
    } finally {
      setSaving(false);
    }
  }

  function toggleYear(year: number) {
    const selected = draft.year_groups.includes(year);
    setDraft({
      ...draft,
      year_groups: selected ? draft.year_groups.filter((item) => item !== year) : [...draft.year_groups, year].sort((a, b) => a - b),
    });
  }

  const activeType = requestTypes.find((item) => item.key === draft.request_type) ?? requestTypes[0];

  return (
    <main className="min-h-screen overflow-hidden bg-[#10192f] text-white">
      <section className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 py-8 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(85,203,211,0.28),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(255,191,69,0.24),transparent_28%),linear-gradient(135deg,#10192f_0%,#173947_52%,#332255_100%)]" />
        <div className="absolute left-0 right-0 top-[18%] h-20 bg-white/5 blur-3xl" />

        <div className="relative z-10">
          <Link href="/" className="btn-pop inline-flex bg-white/12 px-4 py-3 text-sm text-white backdrop-blur">
            Back to NexusLearn
          </Link>
          <p className="font-display mt-10 text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">Access request</p>
          <h1 className="font-display mt-4 max-w-2xl text-5xl font-semibold leading-[0.96] md:text-7xl">
            Build the right launch around your learners.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/76">
            Parents, schools and tutoring organisations can request access here. The platform team can then review demand, configure pupil IDs, classes, tutor groups and curriculum resources without asking children to create email accounts.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {requestTypes.map((item) => (
              <button
                key={item.key}
                onClick={() => setDraft({ ...draft, request_type: item.key, organisation_name: item.key === "parent" ? "" : draft.organisation_name })}
                className={`btn-pop min-h-[116px] p-4 text-left ${draft.request_type === item.key ? "bg-[#ffbf45] text-[#15213e]" : "bg-white/12 text-white backdrop-blur"}`}
              >
                <span className="font-display text-lg font-semibold">{item.label}</span>
                <span className="mt-2 block text-xs leading-5 opacity-75">{item.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <section className="relative z-10 overflow-hidden rounded-lg bg-white text-[#162244] shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
          <div className="relative border-b border-[#162244]/10 bg-[#f7f0df] p-6">
            <div className="absolute right-6 top-6 h-16 w-16 rounded-full bg-[#55cbd3] opacity-75 anim-glow" />
            <p className="font-display text-sm uppercase tracking-[0.16em] text-[#7357c9]">{activeType.label}</p>
            <h2 className="font-display mt-2 text-3xl font-semibold">Request onboarding</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#162244]/66">{activeType.detail}</p>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            {draft.request_type !== "parent" && (
              <Field label="Organisation name" value={draft.organisation_name} onChange={(organisation_name) => setDraft({ ...draft, organisation_name })} />
            )}
            <Field label="Contact name" value={draft.contact_name} onChange={(contact_name) => setDraft({ ...draft, contact_name })} />
            <Field label="Contact email" value={draft.contact_email} onChange={(contact_email) => setDraft({ ...draft, contact_email })} />
            <Field label="Phone" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })} />
            <Field label="Role" value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
            <Field label="Town, borough or region" value={draft.region} onChange={(region) => setDraft({ ...draft, region })} />
            <Field label="Estimated learners" type="number" value={draft.learner_count} onChange={(learner_count) => setDraft({ ...draft, learner_count: Number(learner_count) })} />
          </div>

          <div className="border-t border-[#162244]/10 p-6">
            <p className="text-sm font-semibold text-[#162244]/70">Year groups</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={`btn-pop h-12 w-12 text-sm ${draft.year_groups.includes(year) ? "bg-[#55cbd3] text-[#10233a]" : "bg-[#f6f3ea] text-[#162244]"}`}
                >
                  Y{year}
                </button>
              ))}
            </div>
          </div>

          <label className="block border-t border-[#162244]/10 p-6">
            <span className="text-sm font-semibold text-[#162244]/70">What do your learners need most?</span>
            <textarea
              value={draft.message}
              onChange={(event) => setDraft({ ...draft, message: event.target.value })}
              rows={5}
              className="mt-2 w-full resize-y rounded-lg border border-[#162244]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]"
              placeholder="Example: Year 3-5 maths confidence, SEN-friendly practice, phonics catch-up, homework evidence..."
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#162244]/10 bg-[#fbfaf6] p-6">
            <p className="max-w-xl text-sm leading-6 text-[#162244]/64">{status}</p>
            <button onClick={submit} disabled={saving} className="btn-pop bg-[#ffbf45] px-6 py-4 text-[#162244] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Sending" : "Submit request"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block border-t border-[#162244]/10 p-6 md:border-r">
      <span className="text-sm font-semibold text-[#162244]/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-[#162244]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]"
      />
    </label>
  );
}
