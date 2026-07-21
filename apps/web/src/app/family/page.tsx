"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import MockAssessmentBuilder from "@/components/MockAssessmentBuilder";
import { acceptParentInvitation, createParentAccount, createParentChild, getParentChildEvidence, getParentPortal, logoutAccount, parentLogin, type ParentChildEvidence, type ParentPortal, type ProgressReport, type ProgressSubject, type ProgressTopic, type StudentEngagementProfile } from "@/lib/api";

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
  ["simple_text", "Simple text"],
  ["high_contrast", "High contrast"],
  ["large_targets", "Large targets"],
  ["simplified_controls", "Simplified controls"],
  ["switch_access", "Switch access"],
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
  const [evidenceByChild, setEvidenceByChild] = useState<Record<string, ParentChildEvidence>>({});
  const [message, setMessage] = useState("Create or load a family workspace, then add each child with the support profile they need.");
  const [saving, setSaving] = useState(false);
  const [invitation, setInvitation] = useState("");
  const [invitationProfile, setInvitationProfile] = useState({ display_name: "", password: "" });
  const portalLoadVersion = useRef(0);

  const recommendations = useMemo(() => inclusionSummary(engagement), [engagement]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invitation");
    if (token) {
      setInvitation(token);
      setMessage("Invitation found. Choose your parent account name and password to accept it.");
    }
  }, []);

  async function signup() {
    await guarded("Creating parent account...", async () => {
      const saved = await createParentAccount(parent);
      const loginID = saved.login_id || saved.email;
      const password = parent.password || saved.temporary_password || "";
      setLogin({ login_id: loginID ?? "", password });
      setMessage(`Parent account created. Login ID: ${loginID}.`);
      if (password) await fetchPortal();
    });
  }

  async function loadPortal() {
    await guarded("Loading family workspace...", async () => {
      portalLoadVersion.current += 1;
      setPortal(null);
      setEvidenceByChild({});
      await parentLogin(login.login_id, login.password);
      await fetchPortal();
      setMessage("Family workspace loaded.");
    });
  }

  async function createChild() {
    await guarded("Creating child profile...", async () => {
      const interests = interestText.split(",").map((item) => item.trim()).filter(Boolean);
      await createParentChild({
        ...child,
        external_ref: slug(child.external_ref || `${child.display_name}-${Date.now()}`),
        year_group: Number(child.year_group),
        engagement: { ...engagement, interests },
      });
      setChild({ external_ref: "", display_name: "", year_group: 1 });
      setEngagement(baseEngagement);
      setInterestText("");
      await fetchPortal();
      setMessage("Child profile created and family workspace refreshed.");
    });
  }

  async function fetchPortal() {
    const loadVersion = portalLoadVersion.current + 1;
    portalLoadVersion.current = loadVersion;
    const loaded = await getParentPortal();
    if (loadVersion !== portalLoadVersion.current) return loaded;
    setPortal(loaded);
    const linkedRefs = loaded.children.map((item) => pupilRefFor(item));
    const refsToLoad = linkedRefs.filter((externalRef) => !evidenceByChild[externalRef]);
    const entries = await Promise.allSettled(
      refsToLoad.map(async (externalRef) => {
        const evidence = await getParentChildEvidence(externalRef);
        return [externalRef, evidence] as const;
      })
    );
    if (loadVersion !== portalLoadVersion.current) return loaded;
    const nextEvidence: Record<string, ParentChildEvidence> = {};
    for (const entry of entries) {
      if (entry.status === "fulfilled") nextEvidence[entry.value[0]] = entry.value[1];
    }
    setEvidenceByChild((current) => {
      const linkedEvidence: Record<string, ParentChildEvidence> = {};
      for (const externalRef of linkedRefs) {
        if (current[externalRef]) linkedEvidence[externalRef] = current[externalRef];
      }
      return { ...linkedEvidence, ...nextEvidence };
    });
    return loaded;
  }

  async function loadEvidence(externalRef: string) {
    await guarded("Loading child evidence...", async () => {
      setEvidenceByChild((current) => {
        const next = { ...current };
        delete next[externalRef];
        return next;
      });
      const evidence = await getParentChildEvidence(externalRef);
      setEvidenceByChild((current) => ({ ...current, [externalRef]: evidence }));
      setMessage(`Evidence loaded for ${evidence.child.student.display_name}.`);
    });
  }

  async function acceptInvitation() {
    await guarded("Accepting invitation...", async () => {
      const saved = await acceptParentInvitation({
        token: invitation,
        display_name: invitationProfile.display_name,
        password: invitationProfile.password,
      });
      setLogin({ login_id: saved.login_id || saved.email || "", password: "" });
      setInvitation("");
      window.history.replaceState({}, "", "/family");
      await fetchPortal();
      setMessage("Invitation accepted. Your linked child is ready.");
    });
  }

  async function logout() {
    portalLoadVersion.current += 1;
    await logoutAccount();
    setPortal(null);
    setEvidenceByChild({});
    setLogin({ login_id: "", password: "" });
    setMessage("Signed out securely.");
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

  const childCount = portal?.children.length ?? 0;

  return (
    <main className="min-h-screen bg-[#f6f3ea] text-[#15213d]">
      <div className="mx-auto max-w-7xl px-5 py-5">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-semibold">NexusLearn</Link>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link href="/request-access" className="rounded-lg border border-[#15213d]/12 px-4 py-2">Request access</Link>
            <Link href="/play" className="rounded-lg bg-[#15213d] px-4 py-2 text-white">Child play</Link>
          </div>
        </nav>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.62fr_1.38fr]">
          <aside className="self-start rounded-lg bg-[#15213d] p-6 text-white shadow-[0_24px_70px_rgba(21,33,61,0.22)]">
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#ffdf8a]">Family workspace</p>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-tight md:text-5xl">Set up learning around the child.</h1>
            <p className="mt-4 leading-7 text-white/72">
              Parent access creates child profiles without asking children for email accounts. The Adaptive Inclusion Profile then shapes pacing, scaffolds, animation intensity, audio and reward style.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Metric label="Children" value={String(childCount)} />
              <Metric label="Session" value={labelFor(engagement.session_length)} />
              <Metric label="Sensory" value={labelFor(engagement.sensory_load)} />
            </div>

            <div className="mt-6 rounded-lg border border-white/12 bg-white/8 p-5">
              <p className="font-display text-xl font-semibold">Runtime adaptations</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/74">
                {recommendations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </aside>

          <div className="grid gap-5">
            {invitation && (
              <section className="overflow-hidden rounded-lg bg-white shadow-[0_22px_60px_rgba(21,33,61,0.14)]">
                <SectionHeader eyebrow="Invitation" title="Join your child's learning workspace" detail="The invitation links only the named child after you create a secure parent account." />
                <div className="grid gap-0 border-t border-[#15213d]/10 md:grid-cols-2">
                  <Field label="Your name" value={invitationProfile.display_name} onChange={(display_name) => setInvitationProfile({ ...invitationProfile, display_name })} />
                  <Field label="Choose password" type="password" value={invitationProfile.password} onChange={(password) => setInvitationProfile({ ...invitationProfile, password })} />
                </div>
                <ActionBar message="Invitation links expire after 72 hours and can be revoked by the platform team.">
                  <button onClick={acceptInvitation} disabled={!invitationProfile.display_name || invitationProfile.password.length < 8 || saving} className="btn-pop bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50">Accept invitation</button>
                </ActionBar>
              </section>
            )}
            <section className="overflow-hidden rounded-lg bg-white shadow-[0_22px_60px_rgba(21,33,61,0.14)]">
              <SectionHeader eyebrow="Step 1" title="Parent access" detail="Create a private family workspace or load an existing one." />
              <div className="grid gap-0 border-t border-[#15213d]/10 md:grid-cols-3">
                <Field label="Parent name" value={parent.display_name} onChange={(display_name) => setParent({ ...parent, display_name })} />
                <Field label="Email" value={parent.email} onChange={(email) => setParent({ ...parent, email: email.trim().toLowerCase() })} />
                <Field label="Password" type="password" value={parent.password} onChange={(password) => setParent({ ...parent, password })} />
              </div>
              <ActionBar message={message}>
                <button onClick={signup} disabled={!parent.email || !parent.display_name || !parent.password || saving} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">Create account</button>
              </ActionBar>
              <div className="grid gap-0 border-t border-[#15213d]/10 md:grid-cols-[1fr_1fr_auto_auto]">
                <Field label="Login ID" value={login.login_id} onChange={(login_id) => setLogin({ ...login, login_id })} />
                <Field label="Password" type="password" value={login.password} onChange={(password) => setLogin({ ...login, password })} />
                <button onClick={loadPortal} disabled={!login.login_id || !login.password || saving} className="btn-pop m-5 self-end bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50">Sign in</button>
                {portal && <button onClick={logout} disabled={saving} className="btn-pop m-5 self-end bg-[#15213d] px-5 py-3 text-sm text-white disabled:opacity-50">Sign out</button>}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg bg-white shadow-[0_22px_60px_rgba(21,33,61,0.14)]">
              <SectionHeader eyebrow="Step 2" title="Children" detail="Generated pupil-style credentials keep the child login simple and school-safe." />
              {portal && portal.children.length > 0 ? (
                <div className="grid gap-3 border-t border-[#15213d]/10 p-5 md:grid-cols-2 xl:grid-cols-3">
                  {portal.children.map((item) => {
                    const pupilRef = pupilRefFor(item);
                    const loginHref = `/login?pupil=${encodeURIComponent(pupilRef)}&code=${encodeURIComponent(item.credential.login_code)}`;
                    const evidence = evidenceByChild[pupilRef];
                    const evidenceConfidence = weakestEvidenceConfidence(evidence?.mastery ?? []);
                    return (
                      <article key={pupilRef} className="rounded-lg border border-[#15213d]/10 bg-[#f7f0df] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-xl font-semibold">{item.student.display_name}</p>
                            <p className="mt-1 text-sm text-[#15213d]/58">Year {item.student.year_group}</p>
                          </div>
                          <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#7357c9]">{item.credential.login_code}</span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[#15213d]/62">{item.engagement.declared_support_needs.join(", ") || "No declared support needs selected"}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Link href={loginHref} className="rounded-lg bg-[#15213d] px-3 py-2 text-xs font-semibold text-white">Open child login</Link>
                          <button onClick={() => loadEvidence(pupilRef)} disabled={saving} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#15213d] disabled:opacity-50">Load evidence</button>
                          <span className="text-xs text-[#15213d]/52">Picture password still required.</span>
                        </div>
                        <div className="mt-4">
                          <MockAssessmentBuilder key={`parent:${pupilRef}:${item.student.year_group}`} role="parent" studentId={pupilRef} studentName={item.student.display_name} yearGroup={item.student.year_group} />
                        </div>
                        {evidence && (
                          <div className="mt-4 grid gap-2 rounded-lg bg-white p-3 text-xs text-[#15213d]/68">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <EvidenceMetric label="Attempts" value={String(evidence.summary?.attempts_7_days ?? 0)} />
                              <EvidenceMetric label="Accuracy" value={`${evidence.summary?.accuracy_7_days ?? 0}%`} />
                              <EvidenceMetric label="Open reviews" value={String(evidence.summary?.open_reviews ?? 0)} />
                              <EvidenceMetric label="Evidence" value={evidenceConfidence} />
                            </div>
                            <p className="leading-5">
                              {evidence.next_activity?.explanation || "Next activity will appear after configured learning evidence is available."}
                            </p>
                            <ParentProgressReport progress={evidence.progress} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="border-t border-[#15213d]/10 p-5 text-sm leading-6 text-[#15213d]/62">
                  Load a workspace to see children here, or create the first child profile below.
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-lg bg-white shadow-[0_22px_60px_rgba(21,33,61,0.14)]">
              <SectionHeader eyebrow="Step 3" title="Adaptive child profile" detail="Everything here is configurable support, not a label forced on the child." />
              <div className="grid gap-0 border-t border-[#15213d]/10 md:grid-cols-3">
                <Field label="Child ID" value={child.external_ref} onChange={(external_ref) => setChild({ ...child, external_ref: slug(external_ref) })} />
                <Field label="Child name" value={child.display_name} onChange={(display_name) => setChild({ ...child, display_name })} />
                <Field label="Year group" type="number" value={child.year_group} onChange={(year_group) => setChild({ ...child, year_group: Number(year_group) })} />
              </div>

              <ChoiceGroup title="SEND/support needs" items={supportNeeds} selected={engagement.declared_support_needs} onToggle={(key) => toggle(key, "declared_support_needs")} />
              <ChoiceGroup title="Helpful learning approaches" items={approaches} selected={engagement.learning_approaches} onToggle={(key) => toggle(key, "learning_approaches")} />

              <div className="grid gap-0 border-t border-[#15213d]/10 md:grid-cols-3">
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

              <div className="grid gap-0 border-t border-[#15213d]/10 md:grid-cols-2">
                <Toggle label="Audio support" checked={engagement.audio_support} onChange={(audio_support) => setEngagement({ ...engagement, audio_support })} />
                <Toggle label="Reading support" checked={engagement.reading_support} onChange={(reading_support) => setEngagement({ ...engagement, reading_support })} />
                <Field label="Interests" value={interestText} onChange={setInterestText} placeholder="space, football, drawing" />
                <Field label="Parent notes" value={engagement.notes} onChange={(notes) => setEngagement({ ...engagement, notes })} placeholder="Optional context for the learning team" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#15213d]/10 bg-[#fbfaf6] p-5">
                <p className="max-w-xl text-sm leading-6 text-[#15213d]/62">The runtime already uses this profile to tune mission length, scaffolds, audio, reading support and animation intensity.</p>
                <button onClick={createChild} disabled={!login.login_id || !login.password || !child.display_name || saving} className="btn-pop bg-[#ffbf45] px-6 py-3 text-sm disabled:opacity-50">Create child profile</button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function weakestEvidenceConfidence(mastery: Array<{ evidence_confidence?: string }>) {
  if (!mastery.length) return "Limited";
  const rank: Record<string, number> = { limited: 0, emerging: 1, supported: 2, strong: 3 };
  const weakest = mastery.reduce((current, item) => {
    const candidate = item.evidence_confidence || "limited";
    return (rank[candidate] ?? 0) < (rank[current] ?? 0) ? candidate : current;
  }, "strong");
  return weakest.charAt(0).toUpperCase() + weakest.slice(1);
}

function pupilRefFor(item: ParentPortal["children"][number]) {
  return item.credential.student_external_ref || item.student.external_ref || item.student.student_id;
}

function inclusionSummary(profile: StudentEngagementProfile) {
  const items = [];
  if (profile.sensory_load === "low" || profile.learning_approaches.includes("low_sensory")) items.push("Quieter celebrations, fewer flashes and reduced visual noise.");
  if (profile.attention_support !== "standard" || profile.learning_approaches.includes("short_bursts")) items.push("Shorter mission loops with clear start, middle and finish.");
  if (profile.processing_support !== "standard") items.push("More thinking time, step-by-step scaffolds and fewer timed penalties.");
  if (profile.audio_support || profile.communication_support === "audio_visual") items.push("Audio-first prompts and spoken reinforcement.");
  if (profile.reading_support || profile.declared_support_needs.includes("dyslexia")) items.push("Reading support, visual anchors and reduced text density.");
  if (profile.confidence_support === "gentle" || profile.declared_support_needs.includes("anxiety_confidence")) items.push("Gentle feedback and repair-first language.");
  if (profile.learning_approaches.includes("visual_steps")) items.push("Visual guide opens automatically with a clear look, act and finish routine.");
  if (profile.learning_approaches.includes("simple_text")) items.push("Simple-text mode starts automatically with secondary reading hidden.");
  if (profile.learning_approaches.includes("high_contrast")) items.push("High-contrast presentation starts automatically.");
  if (profile.learning_approaches.includes("large_targets")) items.push("Action targets are enlarged to reduce fine-motor precision demands.");
  if (profile.learning_approaches.includes("simplified_controls")) items.push("Direct-selection interactions are prioritised over dragging, tracing and handwriting.");
  if (profile.learning_approaches.includes("switch_access")) items.push("One-switch scanning starts automatically and single-action formats are prioritised.");
  if (items.length === 0) items.push("Balanced mission pacing, standard animation and world-building rewards.");
  return items;
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="p-5">
      <p className="font-display text-xs uppercase tracking-[0.16em] text-[#7357c9]">{eyebrow}</p>
      <h2 className="font-display mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#15213d]/62">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/12 bg-white/8 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="font-display mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7f0df] p-2">
      <p className="font-display text-lg font-semibold text-[#15213d]">{value}</p>
      <p className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#15213d]/48">{label}</p>
    </div>
  );
}

function ParentProgressReport({ progress }: { progress?: ProgressReport | null }) {
  if (!progress) {
    return <div className="mt-2 rounded-lg border border-[#15213d]/10 bg-[#fbfaf6] p-3 leading-5">Progress pathway will appear after the first evidence sync.</div>;
  }
  const stretchSubjects = progress.subjects.filter((subject) => subject.stretch_allowed).map((subject) => subject.subject);
  return (
    <section className="mt-2 rounded-lg border border-[#7357c9]/18 bg-[#fbfaf6] p-4 text-[#15213d]" aria-label="Child progress report">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">Progress pathway</p>
          <p className="mt-1 text-xs leading-5 text-[#15213d]/62">{progress.summary || `Year ${progress.year_group} is the starting point; each subject follows its own evidence.`}</p>
        </div>
        <span className="rounded-full bg-[#8be28f]/35 px-3 py-1 text-[0.68rem] font-semibold text-[#215d26]">
          {stretchSubjects.length ? `${stretchSubjects.join(", ")} stretching to Y${progress.stretch_year}` : `Core route: Y${progress.year_group}`}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {progress.subjects.map((subject) => <ParentSubjectProgress key={subject.subject} subject={subject} />)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ParentTopicList title="Practise next" topics={progress.practice.slice(0, 3)} tone="practice" empty="No current practice gap has been sampled." />
        <ParentTopicList title="Strengths to retain" topics={progress.strengths.slice(0, 3)} tone="strength" empty="Strengths will appear as varied evidence is collected." />
      </div>
    </section>
  );
}

function ParentSubjectProgress({ subject }: { subject: ProgressSubject }) {
  const width = Math.max(0, Math.min(100, Math.round(subject.average_score)));
  return (
    <article className="rounded-lg border border-[#15213d]/10 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-base font-semibold">{subject.subject}</p>
          <p className="mt-1 text-[0.68rem] text-[#15213d]/58">Y{subject.current_year} baseline · working at Y{subject.working_year} · {subject.sampled_objectives}/{subject.objective_count} sampled</p>
        </div>
        <span className="rounded-full bg-[#f7f0df] px-2 py-1 text-[0.68rem] font-semibold">{labelProgress(subject.status)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#15213d]/8" role="progressbar" aria-label={`${subject.subject} average evidence`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width}>
          <div className={`h-full rounded-full ${subject.stretch_allowed ? "bg-[#9d82ff]" : "bg-[#55cbd3]"}`} style={{ width: `${width}%` }} />
        </div>
        <span className="w-10 text-right text-[0.68rem] font-semibold">{width}%</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${subject.subject} year route status`}>
        {subject.years.map((year) => (
          <span key={year.year} className={`rounded-full px-2 py-1 text-[0.64rem] font-semibold ${progressColour(year.status)}`}>Y{year.year}: {labelProgress(year.status)}</span>
        ))}
      </div>
    </article>
  );
}

function ParentTopicList({ title, topics, tone, empty }: { title: string; topics: ProgressTopic[]; tone: "practice" | "strength"; empty: string }) {
  return (
    <div className="rounded-lg border border-[#15213d]/10 bg-white p-3">
      <p className="font-display text-sm font-semibold">{title}</p>
      {topics.length ? (
        <ul className="mt-2 grid gap-1.5">
          {topics.map((topic) => <li key={topic.objective_id} className="flex gap-2 leading-5"><span className={tone === "strength" ? "text-[#2c9b63]" : "text-[#d97919]"} aria-hidden="true">{tone === "strength" ? "✓" : "•"}</span><span>{topic.topic || topic.statement}<span className="block text-[0.66rem] text-[#15213d]/48">Y{topic.year} · {topic.score}% evidence</span></span></li>)}
        </ul>
      ) : <p className="mt-2 leading-5 text-[#15213d]/52">{empty}</p>}
    </div>
  );
}

function labelProgress(status: string) {
  switch (status) {
    case "ahead": return "Ahead";
    case "secure": return "Secure";
    case "on_track": return "On track";
    case "needs_practice": return "Practise";
    default: return "Not sampled";
  }
}

function progressColour(status: string) {
  switch (status) {
    case "ahead": return "bg-[#e7dcff] text-[#5035a1]";
    case "secure": return "bg-[#dff7e5] text-[#215d26]";
    case "on_track": return "bg-[#d9f7fa] text-[#16616a]";
    case "needs_practice": return "bg-[#fff0c9] text-[#6a4a00]";
    default: return "bg-[#15213d]/8 text-[#15213d]/55";
  }
}

function ActionBar({ message, children }: { message: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#15213d]/10 bg-[#fbfaf6] p-5">
      <p className="max-w-xl text-sm leading-6 text-[#15213d]/62">{message}</p>
      {children}
    </div>
  );
}

function ChoiceGroup({ title, items, selected, onToggle }: { title: string; items: readonly (readonly [string, string])[]; selected: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="border-t border-[#15213d]/10 p-5">
      <p className="text-sm font-semibold text-[#15213d]/70">{title} <span className="font-normal text-[#15213d]/45">Optional</span></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map(([key, label]) => (
          <button key={key} onClick={() => onToggle(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${selected.includes(key) ? "bg-[#7357c9] text-white" : "bg-[#f7f0df] text-[#15213d]"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password"; placeholder?: string }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#15213d]/70">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#15213d]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#15213d]/70">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#15213d]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item} value={item}>{labelFor(item)}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 p-5">
      <span className="text-sm font-semibold text-[#15213d]/70">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#7357c9]" />
    </label>
  );
}

function labelFor(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
