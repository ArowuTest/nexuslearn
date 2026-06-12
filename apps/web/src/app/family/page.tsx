"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createParentAccount, createParentChild, getParentPortal, type ParentPortal, type StudentEngagementProfile } from "@/lib/api";

const supportNeeds = [
  ["adhd", "ADHD"],
  ["autism", "Autism"],
  ["dyslexia", "Dyslexia"],
  ["dyspraxia", "Dyspraxia"],
  ["dyscalculia", "Dyscalculia"],
  ["speech_language", "Speech/language"],
  ["sensory", "Sensory sensitivity"],
  ["working_memory", "Working memory"],
  ["processing_speed", "Processing speed"],
  ["eal", "English as an additional language"],
  ["hearing", "Hearing support"],
  ["vision", "Vision support"],
  ["anxiety_confidence", "Anxiety/confidence"],
  ["fine_motor", "Fine motor"],
  ["other", "Other"],
] as const;

const approaches = [
  ["predictable_routine", "Predictable routine"],
  ["short_bursts", "Short bursts"],
  ["visual_steps", "Visual steps"],
  ["audio_read_aloud", "Read aloud"],
  ["reduced_motion", "Reduced motion"],
  ["low_sensory", "Low sensory"],
  ["extra_processing_time", "Extra time"],
  ["worked_examples", "Worked examples"],
  ["confidence_first", "Confidence first"],
  ["movement_breaks", "Movement breaks"],
  ["teach_back", "Teach-back"],
  ["high_challenge", "High challenge"],
] as const;

const baseEngagement: StudentEngagementProfile = {
  declared_support_needs: [],
  learning_approaches: ["predictable_routine", "worked_examples"],
  celebration_intensity: "balanced",
  audio_support: false,
  reading_support: false,
  session_length: "standard",
  sensory_load: "balanced",
  attention_support: "standard",
  communication_support: "standard",
  processing_support: "standard",
  confidence_support: "balanced",
  companion_style: "friendly",
  reward_style: "world_building",
  interests: [],
  notes: "",
};

export default function FamilyPage() {
  const [parent, setParent] = useState({ email: "", display_name: "", password: "" });
  const [login, setLogin] = useState({ login_id: "", password: "" });
  const [portal, setPortal] = useState<ParentPortal | null>(null);
  const [child, setChild] = useState({ external_ref: "", display_name: "", year_group: 1 });
  const [engagement, setEngagement] = useState<StudentEngagementProfile>(baseEngagement);
  const [interestText, setInterestText] = useState("");
  const [message, setMessage] = useState("Create a parent account, then build each child profile with support and learning preferences.");
  const [saving, setSaving] = useState(false);

  const recommendations = useMemo(() => inclusionSummary(engagement), [engagement]);

  async function signup() {
    await guarded("Creating parent account...", async () => {
      const saved = await createParentAccount(parent);
      const loginID = saved.login_id || saved.email;
      const password = parent.password || saved.temporary_password || "";
      setLogin({ login_id: loginID ?? "", password });
      setMessage(`Parent account created. Login ID: ${loginID}.`);
      if (password) {
        const loaded = await getParentPortal(loginID ?? "", password);
        setPortal(loaded);
      }
    });
  }

  async function loadPortal() {
    await guarded("Loading family workspace...", async () => {
      const loaded = await getParentPortal(login.login_id, login.password);
      setPortal(loaded);
      setMessage("Family workspace loaded.");
    });
  }

  async function createChild() {
    await guarded("Creating child profile...", async () => {
      const interests = interestText.split(",").map((item) => item.trim()).filter(Boolean);
      await createParentChild(login.login_id, login.password, {
        ...child,
        external_ref: slug(child.external_ref || `${child.display_name}-${Date.now()}`),
        year_group: Number(child.year_group),
        engagement: { ...engagement, interests },
      });
      setChild({ external_ref: "", display_name: "", year_group: 1 });
      setEngagement(baseEngagement);
      setInterestText("");
      await loadPortal();
    });
  }

  async function guarded(progress: string, action: () => Promise<void>) {
    setSaving(true);
    setMessage(progress);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  function toggle(key: string, field: "declared_support_needs" | "learning_approaches") {
    const values = engagement[field];
    setEngagement({
      ...engagement,
      [field]: values.includes(key) ? values.filter((item) => item !== key) : [...values, key],
    });
  }

  return (
    <main className="min-h-screen bg-[#111b35] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#111b35_0%,#123f52_48%,#48285f_100%)]" />
        <div className="relative mx-auto grid min-h-screen max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[0.72fr_1.28fr]">
          <aside className="self-start">
            <Link href="/" className="btn-pop inline-flex bg-white/12 px-4 py-3 text-sm backdrop-blur">Back</Link>
            <p className="font-display mt-10 text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">Direct family access</p>
            <h1 className="font-display mt-4 text-5xl font-semibold leading-[0.96] md:text-6xl">Personalised learning starts with knowing the child.</h1>
            <p className="mt-5 text-lg leading-8 text-white/76">
              Parents can create child profiles, child-friendly login access and an Adaptive Inclusion Profile that shapes mission length, sensory load, scaffolding, audio, rewards and companion tone.
            </p>
            <div className="mt-8 rounded-lg bg-white/10 p-5 backdrop-blur">
              <p className="font-display text-xl font-semibold">Current adaptation</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/76">
                {recommendations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </aside>

          <div className="grid gap-6">
            <section className="rounded-lg bg-white text-[#17233f] shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
              <div className="border-b border-[#17233f]/10 p-5">
                <h2 className="font-display text-2xl font-semibold">Parent account</h2>
              </div>
              <div className="grid gap-0 md:grid-cols-3">
                <Field label="Parent name" value={parent.display_name} onChange={(display_name) => setParent({ ...parent, display_name })} />
                <Field label="Email" value={parent.email} onChange={(email) => setParent({ ...parent, email: email.trim().toLowerCase() })} />
                <Field label="Password" type="password" value={parent.password} onChange={(password) => setParent({ ...parent, password })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#17233f]/10 p-5">
                <p className="text-sm text-[#17233f]/62">{message}</p>
                <button onClick={signup} disabled={!parent.email || !parent.display_name || !parent.password || saving} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">Create account</button>
              </div>
            </section>

            <section className="rounded-lg bg-white text-[#17233f] shadow-[0_28px_80px_rgba(0,0,0,0.24)]">
              <div className="border-b border-[#17233f]/10 p-5">
                <h2 className="font-display text-2xl font-semibold">Family workspace</h2>
              </div>
              <div className="grid gap-0 md:grid-cols-[1fr_1fr_auto]">
                <Field label="Login ID" value={login.login_id} onChange={(login_id) => setLogin({ ...login, login_id })} />
                <Field label="Password" type="password" value={login.password} onChange={(password) => setLogin({ ...login, password })} />
                <button onClick={loadPortal} disabled={!login.login_id || !login.password || saving} className="btn-pop m-5 self-end bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50">Load</button>
              </div>
              {portal && (
                <div className="grid gap-3 border-t border-[#17233f]/10 p-5 md:grid-cols-3">
                  {portal.children.map((item) => (
                    <article key={item.student.external_ref || item.student.student_id} className="rounded-lg bg-[#f7f0df] p-4">
                      <p className="font-display text-xl font-semibold">{item.student.display_name}</p>
                      <p className="mt-1 text-sm text-[#17233f]/58">Y{item.student.year_group} / {item.credential.login_code}</p>
                      <p className="mt-3 text-xs leading-5 text-[#17233f]/62">{item.engagement.declared_support_needs.join(", ") || "No declared support needs"}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg bg-white text-[#17233f] shadow-[0_28px_80px_rgba(0,0,0,0.24)]">
              <div className="border-b border-[#17233f]/10 p-5">
                <h2 className="font-display text-2xl font-semibold">Create child profile</h2>
              </div>
              <div className="grid gap-0 md:grid-cols-3">
                <Field label="Child ID" value={child.external_ref} onChange={(external_ref) => setChild({ ...child, external_ref: slug(external_ref) })} />
                <Field label="Child name" value={child.display_name} onChange={(display_name) => setChild({ ...child, display_name })} />
                <Field label="Year group" type="number" value={child.year_group} onChange={(year_group) => setChild({ ...child, year_group: Number(year_group) })} />
              </div>

              <ChoiceGroup title="Declared Support Needs" items={supportNeeds} selected={engagement.declared_support_needs} onToggle={(key) => toggle(key, "declared_support_needs")} />
              <ChoiceGroup title="Learning Approach" items={approaches} selected={engagement.learning_approaches} onToggle={(key) => toggle(key, "learning_approaches")} />

              <div className="grid gap-0 border-t border-[#17233f]/10 md:grid-cols-3">
                <Select label="Sensory load" value={engagement.sensory_load} values={["low", "balanced", "high"]} onChange={(sensory_load) => setEngagement({ ...engagement, sensory_load: sensory_load as StudentEngagementProfile["sensory_load"] })} />
                <Select label="Attention support" value={engagement.attention_support} values={["standard", "chunked", "high_structure"]} onChange={(attention_support) => setEngagement({ ...engagement, attention_support: attention_support as StudentEngagementProfile["attention_support"] })} />
                <Select label="Processing support" value={engagement.processing_support} values={["standard", "extra_time", "step_by_step"]} onChange={(processing_support) => setEngagement({ ...engagement, processing_support: processing_support as StudentEngagementProfile["processing_support"] })} />
                <Select label="Communication" value={engagement.communication_support} values={["standard", "visual", "audio_visual"]} onChange={(communication_support) => setEngagement({ ...engagement, communication_support: communication_support as StudentEngagementProfile["communication_support"] })} />
                <Select label="Confidence support" value={engagement.confidence_support} values={["gentle", "balanced", "challenge"]} onChange={(confidence_support) => setEngagement({ ...engagement, confidence_support: confidence_support as StudentEngagementProfile["confidence_support"] })} />
                <Select label="Session length" value={engagement.session_length} values={["short", "standard", "extended"]} onChange={(session_length) => setEngagement({ ...engagement, session_length: session_length as StudentEngagementProfile["session_length"] })} />
                <Select label="Celebration" value={engagement.celebration_intensity} values={["quiet", "balanced", "big"]} onChange={(celebration_intensity) => setEngagement({ ...engagement, celebration_intensity: celebration_intensity as StudentEngagementProfile["celebration_intensity"] })} />
                <Select label="Companion" value={engagement.companion_style} values={["friendly", "funny", "calm", "coach"]} onChange={(companion_style) => setEngagement({ ...engagement, companion_style: companion_style as StudentEngagementProfile["companion_style"] })} />
                <Select label="Reward" value={engagement.reward_style} values={["world_building", "collecting", "story", "challenge"]} onChange={(reward_style) => setEngagement({ ...engagement, reward_style: reward_style as StudentEngagementProfile["reward_style"] })} />
              </div>

              <div className="grid gap-0 border-t border-[#17233f]/10 md:grid-cols-2">
                <Toggle label="Audio support" checked={engagement.audio_support} onChange={(audio_support) => setEngagement({ ...engagement, audio_support })} />
                <Toggle label="Reading support" checked={engagement.reading_support} onChange={(reading_support) => setEngagement({ ...engagement, reading_support })} />
                <Field label="Interests" value={interestText} onChange={setInterestText} />
                <Field label="Parent notes" value={engagement.notes} onChange={(notes) => setEngagement({ ...engagement, notes })} />
              </div>
              <div className="flex justify-end border-t border-[#17233f]/10 p-5">
                <button onClick={createChild} disabled={!login.login_id || !login.password || !child.display_name || saving} className="btn-pop bg-[#ffbf45] px-6 py-3 text-sm disabled:opacity-50">Create child profile</button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

function inclusionSummary(profile: StudentEngagementProfile) {
  const items = [];
  if (profile.sensory_load === "low" || profile.learning_approaches.includes("low_sensory")) items.push("Quieter celebrations, fewer flashes and reduced visual noise.");
  if (profile.attention_support !== "standard" || profile.learning_approaches.includes("short_bursts")) items.push("Shorter mission loops with clear start, middle and finish.");
  if (profile.processing_support !== "standard") items.push("More thinking time, step-by-step scaffolds and fewer timed penalties.");
  if (profile.audio_support || profile.communication_support === "audio_visual") items.push("Audio-first prompts and spoken reinforcement.");
  if (profile.reading_support || profile.declared_support_needs.includes("dyslexia")) items.push("Reading support, visual anchors and reduced text density.");
  if (profile.confidence_support === "gentle" || profile.declared_support_needs.includes("anxiety_confidence")) items.push("Gentle feedback and repair-first language.");
  if (items.length === 0) items.push("Balanced mission pacing, standard animation and world-building rewards.");
  return items;
}

function ChoiceGroup({ title, items, selected, onToggle }: { title: string; items: readonly (readonly [string, string])[]; selected: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="border-t border-[#17233f]/10 p-5">
      <p className="text-sm font-semibold text-[#17233f]/70">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(([key, label]) => (
          <button key={key} onClick={() => onToggle(key)} className={`btn-pop px-3 py-2 text-xs ${selected.includes(key) ? "bg-[#7357c9] text-white" : "bg-[#f7f0df] text-[#17233f]"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password" }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#7357c9]" />
    </label>
  );
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
