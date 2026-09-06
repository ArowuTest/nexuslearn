"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import MockAssessmentBuilder from "@/components/MockAssessmentBuilder";
import MockAssessmentHistory from "@/components/MockAssessmentHistory";
import ProgressSnapshot from "@/components/ProgressSnapshot";
import AttemptEvidencePanel from "@/components/AttemptEvidencePanel";
import { Actions, BooleanField, ChoiceGrid, Field, LabeledSelect, LearnerScopeNotice, LoginCard, Panel, PurposeSelect, Row, TextArea } from "@/components/role-workspaces/SchoolWorkspacePrimitives";
import { WorkspaceNavigation, WorkspaceState } from "@/components/role-workspaces/WorkspaceNavigation";
import { accountSessionHeaders, logoutAccount, storeAccountSession, type AccountSession, type ProgressReport } from "@/lib/api";

type Student = { external_ref: string; display_name: string; year_group: number };
type ClassGroup = { id?: string; school_urn?: string; name: string; year_group: number; students?: Student[] };
type LearningGroup = { id?: string; class_id: string; class_name?: string; name: string; purpose: string; students?: Student[] };
type StudentCredential = { student_external_ref: string; display_name?: string; login_code: string; picture_password: string[]; qr_secret_hash?: string };
type SchoolUser = { login_id: string; display_name?: string; role: string; school_urn: string };
type LearningAssignment = {
  id?: string;
  student_external_ref: string;
  student_display_name?: string;
  objective_id: string;
  activity_id?: string;
  title: string;
  priority: number;
  status?: string;
  due_at?: string;
};
type TeacherEvidence = {
  id?: string;
  student_external_ref: string;
  student_display_name?: string;
  objective_id: string;
  evidence_type: string;
  outcome: string;
  note: string;
  source_ref?: string;
};
type Intervention = {
  id?: string;
  student_external_ref: string;
  student_display_name?: string;
  objective_id: string;
  title: string;
  need: string;
  strategy: string;
  priority: number;
  status?: string;
  review_due_at?: string;
};
type InterventionReview = {
  id?: string;
  intervention_id: string;
  student_display_name?: string;
  student_external_ref?: string;
  objective_id?: string;
  outcome: "continue" | "monitor" | "complete" | "reopen";
  evidence_note: string;
  next_review_due_at?: string;
  reviewed_at?: string;
};
type SchoolPortal = {
  school?: { urn: string; name: string; status: string };
  current_user?: SchoolUser;
  classes?: ClassGroup[];
  groups?: LearningGroup[];
  student_credentials?: StudentCredential[];
};
type StudentEngagementProfile = {
  student_external_ref: string;
  declared_support_needs: string[];
  learning_approaches: string[];
  celebration_intensity: string;
  audio_support: boolean;
  reading_support: boolean;
  session_length: string;
  sensory_load: string;
  attention_support: string;
  communication_support: string;
  processing_support: string;
  confidence_support: string;
  companion_style: string;
  reward_style: string;
  interests: string[];
  notes: string;
  updated_at?: string;
};

const API = process.env.NEXT_PUBLIC_API_URL;
const picturePool = ["star", "book", "sun", "tree", "rocket", "moon", "shell", "key"];
const supportNeeds = ["adhd", "autism", "dyslexia", "dyspraxia", "dyscalculia", "speech_language", "sensory", "working_memory", "processing_speed", "eal", "hearing", "vision", "anxiety_confidence", "fine_motor", "other"];
const learningApproaches = ["simple_text", "high_contrast", "large_targets", "simplified_controls", "switch_access", "predictable_routine", "short_bursts", "visual_steps", "audio_read_aloud", "reduced_motion", "low_sensory", "extra_processing_time", "worked_examples", "confidence_first", "movement_breaks", "teach_back", "high_challenge"];

function emptyEngagementProfile(studentExternalRef = ""): StudentEngagementProfile {
  return {
    student_external_ref: studentExternalRef,
    declared_support_needs: [],
    learning_approaches: [],
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
}

function runtimePreviewItems(profile: StudentEngagementProfile): Array<[string, string]> {
  const approaches = new Set(profile.learning_approaches);
  const items: Array<[string, string] | null> = [
    profile.session_length === "short" || approaches.has("short_bursts")
      ? ["Short mission pacing", "The child runtime limits question count and makes completion feel reachable."]
      : null,
    profile.sensory_load === "low" || approaches.has("low_sensory") || approaches.has("reduced_motion")
      ? ["Low sensory visuals", "Motion, celebration intensity and visual noise are reduced by default."]
      : null,
    profile.audio_support || profile.communication_support === "audio_visual" || approaches.has("audio_read_aloud")
      ? ["Audio-first prompts", "Teaching steps and eligible questions surface replayable narration controls."]
      : null,
    profile.reading_support || approaches.has("simple_text") || profile.communication_support === "visual"
      ? ["Reading/visual scaffolds", "Plain-language cues and visual task steps stay visible during practice."]
      : null,
    profile.processing_support === "step_by_step" || approaches.has("worked_examples")
      ? ["Step-by-step teaching", "The mission models the idea before moving into independent questions."]
      : null,
    profile.attention_support !== "standard" || approaches.has("predictable_routine")
      ? ["Predictable routine", "The mission keeps a Learn, Practise, Finish schedule and chunked evidence flow."]
      : null,
    approaches.has("switch_access") || approaches.has("large_targets") || approaches.has("simplified_controls")
      ? ["Accessible controls", "Large targets, simplified interaction and switch scanning can be activated in mission."]
      : null,
    profile.confidence_support === "gentle" || approaches.has("confidence_first")
      ? ["Confidence-first feedback", "The companion uses calmer correction, optional confidence checks and repair hints."]
      : null,
  ];
  return items.filter((item): item is [string, string] => Boolean(item));
}

export default function SchoolAdminPage() {
  const [schoolURN, setSchoolURN] = useState("");
  const [loginID, setLoginID] = useState("");
  const [password, setPassword] = useState("");
  const [portal, setPortal] = useState<SchoolPortal | null>(null);
  const [message, setMessage] = useState("Use the school login details issued by platform admin.");
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<Student>({ external_ref: "", display_name: "", year_group: 1 });
  const [classDraft, setClassDraft] = useState<ClassGroup>({ id: "", name: "", year_group: 1, students: [] });
  const [assignment, setAssignment] = useState({ class_id: "", student_external_ref: "" });
  const [learningAssignments, setLearningAssignments] = useState<LearningAssignment[]>([]);
  const [learningAssignment, setLearningAssignment] = useState<LearningAssignment>({
    student_external_ref: "",
    objective_id: "",
    activity_id: "",
    title: "",
    priority: 70,
    due_at: "",
  });
  const [teacherEvidence, setTeacherEvidence] = useState<TeacherEvidence[]>([]);
  const [evidenceDraft, setEvidenceDraft] = useState<TeacherEvidence>({
    student_external_ref: "",
    objective_id: "",
    evidence_type: "observation",
    outcome: "developing",
    note: "",
    source_ref: "",
  });
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [interventionReviews, setInterventionReviews] = useState<InterventionReview[]>([]);
  const [reviewDraft, setReviewDraft] = useState<InterventionReview>({
    intervention_id: "",
    outcome: "monitor",
    evidence_note: "",
    next_review_due_at: "",
  });
  const [interventionDraft, setInterventionDraft] = useState<Intervention>({
    student_external_ref: "",
    objective_id: "",
    title: "",
    need: "",
    strategy: "",
    priority: 85,
    review_due_at: "",
  });
  const [group, setGroup] = useState<LearningGroup>({ id: "", class_id: "", name: "", purpose: "intervention", students: [] });
  const [engagementPupil, setEngagementPupil] = useState("");
  const [engagementProfile, setEngagementProfile] = useState<StudentEngagementProfile>(emptyEngagementProfile());
  const [engagementInterests, setEngagementInterests] = useState("");
  const [progressReport, setProgressReport] = useState<ProgressReport | null>(null);
  const workspaceLoadVersion = useRef(0);
  const progressRequest = useRef(0);
  const credentials = portal?.student_credentials ?? [];
  const isSchoolAdmin = portal?.current_user?.role === "school_admin";
  const runtimePreview = runtimePreviewItems(engagementProfile);
  const schoolStudents = useMemo(() => {
    const byID = new Map<string, Student>();
    (portal?.classes ?? []).forEach((item) => (item.students ?? []).forEach((learner) => byID.set(learner.external_ref, learner)));
    return Array.from(byID.values()).sort((left, right) => left.display_name.localeCompare(right.display_name));
  }, [portal]);
  const schoolStudentLabels = useMemo(
    () => Object.fromEntries(schoolStudents.map((item) => [item.external_ref, `${item.display_name} / Year ${item.year_group}`])),
    [schoolStudents],
  );
  const selectedEngagementStudent = schoolStudents.find((item) => item.external_ref === engagementPupil);

  const totals = useMemo(() => {
    const students = new Set<string>();
    (portal?.classes ?? []).forEach((item) => (item.students ?? []).forEach((learner) => students.add(learner.external_ref)));
    return [
      ["Classes", portal?.classes?.length ?? 0],
      ["Groups", portal?.groups?.length ?? 0],
      ["Pupils", students.size],
      ["Login packs", credentials.length],
    ];
  }, [portal, credentials.length]);

  function headers() {
    return {
      "Content-Type": "application/json",
      ...accountSessionHeaders(["school_admin", "teacher"]),
    };
  }

  function resetWorkspace() {
    workspaceLoadVersion.current += 1;
    setPortal(null);
    setStudent({ external_ref: "", display_name: "", year_group: 1 });
    setClassDraft({ id: "", name: "", year_group: 1, students: [] });
    setAssignment({ class_id: "", student_external_ref: "" });
    setLearningAssignments([]);
    setLearningAssignment({ student_external_ref: "", objective_id: "", activity_id: "", title: "", priority: 70, due_at: "" });
    setTeacherEvidence([]);
    setEvidenceDraft({ student_external_ref: "", objective_id: "", evidence_type: "observation", outcome: "developing", note: "", source_ref: "" });
    setInterventions([]);
    setInterventionReviews([]);
    setReviewDraft({ intervention_id: "", outcome: "monitor", evidence_note: "", next_review_due_at: "" });
    setInterventionDraft({ student_external_ref: "", objective_id: "", title: "", need: "", strategy: "", priority: 85, review_due_at: "" });
    setGroup({ id: "", class_id: "", name: "", purpose: "intervention", students: [] });
    setEngagementPupil("");
    setEngagementProfile(emptyEngagementProfile());
    setEngagementInterests("");
    clearProgressReport();
  }

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!API) throw new Error("API is not configured.");
    const requestHeaders: Record<string, string> = { ...headers(), ...(options.headers ?? {}) as Record<string, string> };
    if ((options.method || "GET").toUpperCase() === "POST" && !requestHeaders["Idempotency-Key"]) {
      requestHeaders["Idempotency-Key"] = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }
    const res = await fetch(`${API}${path}`, { ...options, headers: requestHeaders });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Request failed.");
    return body;
  }

  async function loadWorkspace() {
    const loadVersion = workspaceLoadVersion.current + 1;
    workspaceLoadVersion.current = loadVersion;
    try {
      const [data, assignmentData, evidenceData, interventionData, reviewData] = await Promise.all([
        apiFetch("/v1/school/config"),
        apiFetch("/v1/school/assignments"),
        apiFetch("/v1/school/evidence"),
        apiFetch("/v1/school/interventions"),
        apiFetch("/v1/school/intervention-reviews"),
      ]);
      if (loadVersion !== workspaceLoadVersion.current) return;
      const loadedPortal = data as SchoolPortal;
      if (!loadedPortal.current_user) throw new Error("School workspace authentication could not be verified.");
      setPortal(loadedPortal);
      setLearningAssignments(assignmentData.assignments ?? []);
      setTeacherEvidence(evidenceData.teacher_evidence ?? []);
      setInterventions(interventionData.interventions ?? []);
      setInterventionReviews(reviewData.intervention_reviews ?? []);
    } catch (error) {
      if (loadVersion === workspaceLoadVersion.current) resetWorkspace();
      throw error;
    }
  }

  async function load() {
    await guarded("Loading school workspace...", async () => {
      await loadWorkspace();
      setMessage("School workspace loaded.");
    });
  }

  async function signIn() {
    await guarded("Signing in...", async () => {
      resetWorkspace();
      if (!API) throw new Error("API is not configured.");
      const res = await fetch(`${API}/v1/auth/school-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school_urn: schoolURN, login_id: loginID, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "School login failed.");
      storeAccountSession(body.session as AccountSession);
      setPassword("");
      await loadWorkspace();
      setMessage("School workspace loaded.");
    });
  }

  async function logout() {
    resetWorkspace();
    setMessage("Signing out securely...");
    try {
      await logoutAccount();
    } finally {
      setMessage("Signed out securely.");
    }
  }

  async function saveStudent() {
    await guarded("Creating pupil...", async () => {
      await apiFetch(`/v1/school/students/${slug(student.external_ref)}`, {
        method: "PUT",
        body: JSON.stringify({ display_name: student.display_name, year_group: Number(student.year_group) }),
      });
      setStudent({ external_ref: "", display_name: "", year_group: 1 });
      await load();
    });
  }

  async function loadEngagementProfile() {
    const studentExternalRef = selectedEngagementStudent?.external_ref;
    if (!studentExternalRef) return;
    await guarded("Loading pupil support profile...", async () => {
      const profile = await apiFetch(`/v1/school/students/${encodeURIComponent(studentExternalRef)}/engagement`);
      setEngagementProfile({ ...emptyEngagementProfile(studentExternalRef), ...profile, student_external_ref: studentExternalRef });
      setEngagementInterests((profile.interests ?? []).join(", "));
      setMessage("Pupil support profile loaded.");
    });
  }

  function clearProgressReport() {
    progressRequest.current += 1;
    setProgressReport(null);
  }

  async function loadProgressReport() {
    const studentExternalRef = selectedEngagementStudent?.external_ref;
    if (!studentExternalRef) return;
    clearProgressReport();
    const request = progressRequest.current;
    await guarded("Loading learner progress...", async () => {
      try {
        const data = await apiFetch(`/v1/school/students/${encodeURIComponent(studentExternalRef)}/progress`);
        if (request === progressRequest.current) setProgressReport(data as ProgressReport);
      } catch (error) {
        if (request === progressRequest.current) throw error;
      }
    });
  }

  async function saveEngagementProfile() {
    const studentExternalRef = selectedEngagementStudent?.external_ref;
    if (!studentExternalRef) return;
    await guarded("Saving pupil support profile...", async () => {
      const profile = await apiFetch(`/v1/school/students/${encodeURIComponent(studentExternalRef)}/engagement`, {
        method: "PUT",
        body: JSON.stringify({ ...engagementProfile, student_external_ref: studentExternalRef, interests: commaValues(engagementInterests) }),
      });
      setEngagementProfile({ ...emptyEngagementProfile(studentExternalRef), ...profile, student_external_ref: studentExternalRef });
      setEngagementInterests((profile.interests ?? []).join(", "));
      setMessage("Pupil support profile saved.");
    });
  }

  async function saveClass() {
    await guarded("Saving class...", async () => {
      await apiFetch(`/v1/school/classes/${classDraft.id || slug(classDraft.name)}`, {
        method: "PUT",
        body: JSON.stringify({ name: classDraft.name, year_group: Number(classDraft.year_group) }),
      });
      setClassDraft({ id: "", name: "", year_group: 1, students: [] });
      await load();
    });
  }

  async function assignStudent() {
    await guarded("Adding pupil to class...", async () => {
      await apiFetch(`/v1/school/classes/${assignment.class_id}/students/${slug(assignment.student_external_ref)}`, { method: "PUT", body: "{}" });
      setAssignment({ class_id: assignment.class_id, student_external_ref: "" });
      await load();
    });
  }

  async function generateCredentials(classID: string) {
    await guarded("Generating login cards...", async () => {
      await apiFetch(`/v1/school/classes/${classID}/credentials`, {
        method: "PUT",
        body: JSON.stringify({ overwrite: false, picture_pool: picturePool }),
      });
      await load();
    });
  }

  async function saveGroup() {
    await guarded("Saving group...", async () => {
      await apiFetch(`/v1/school/groups/${group.id || slug(group.name)}`, {
        method: "PUT",
        body: JSON.stringify({ class_id: group.class_id, name: group.name, purpose: group.purpose }),
      });
      setGroup({ id: "", class_id: "", name: "", purpose: "intervention", students: [] });
      await load();
    });
  }

  async function saveLearningAssignment() {
    await guarded("Assigning learning priority...", async () => {
      await apiFetch("/v1/school/assignments", {
        method: "POST",
        body: JSON.stringify({
          ...learningAssignment,
          student_external_ref: slug(learningAssignment.student_external_ref),
          due_at: learningAssignment.due_at ? new Date(learningAssignment.due_at).toISOString() : "",
          status: "active",
          priority: Number(learningAssignment.priority),
        }),
      });
      setLearningAssignment({
        student_external_ref: "",
        objective_id: "",
        activity_id: "",
        title: "",
        priority: 70,
        due_at: "",
      });
      await load();
    });
  }

  async function saveTeacherEvidence() {
    await guarded("Saving moderated teacher evidence...", async () => {
      await apiFetch("/v1/school/evidence", {
        method: "POST",
        body: JSON.stringify({ ...evidenceDraft, student_external_ref: slug(evidenceDraft.student_external_ref) }),
      });
      setEvidenceDraft({
        student_external_ref: "",
        objective_id: "",
        evidence_type: "observation",
        outcome: "developing",
        note: "",
        source_ref: "",
      });
      await load();
    });
  }

  async function saveIntervention() {
    await guarded("Creating intervention plan...", async () => {
      await apiFetch("/v1/school/interventions", {
        method: "POST",
        body: JSON.stringify({
          ...interventionDraft,
          student_external_ref: slug(interventionDraft.student_external_ref),
          priority: Number(interventionDraft.priority),
          review_due_at: interventionDraft.review_due_at ? new Date(interventionDraft.review_due_at).toISOString() : "",
          status: "active",
        }),
      });
      setInterventionDraft({
        student_external_ref: "",
        objective_id: "",
        title: "",
        need: "",
        strategy: "",
        priority: 85,
        review_due_at: "",
      });
      await load();
    });
  }

  async function saveInterventionReview() {
    await guarded("Saving intervention reassessment...", async () => {
      await apiFetch(`/v1/school/interventions/${reviewDraft.intervention_id}/reviews`, {
        method: "POST",
        body: JSON.stringify({
          outcome: reviewDraft.outcome,
          evidence_note: reviewDraft.evidence_note,
          next_review_due_at: reviewDraft.next_review_due_at ? new Date(reviewDraft.next_review_due_at).toISOString() : "",
        }),
      });
      setReviewDraft({ intervention_id: "", outcome: "monitor", evidence_note: "", next_review_due_at: "" });
      await load();
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

  return (
    <main className="min-h-screen bg-[#f7f0df] px-5 py-8 text-[#17233f]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">School workspace</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">Classes, groups and pupil access</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#17233f]/64">
              Schools manage their own internal structure here. Pupils use generated login codes and picture passwords, not email accounts.
            </p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-3 text-sm shadow-card">Home</Link>
        </div>

        {portal?.current_user ? (
          <WorkspaceNavigation
            label="School workspace sections"
            items={[
              { href: "#school-setup", label: "Setup & access", detail: "sign-in and login cards" },
              { href: "#school-people", label: "Groups & pupils", detail: "classes and teaching groups" },
              { href: "#school-learning", label: "Learning & evidence", detail: "progress, assignments and mocks" },
              { href: "#school-support", label: "Support & interventions", detail: "SEND access and reassessment" },
            ]}
          />
        ) : null}

        <section id="school-setup" className="scroll-mt-28 mt-8 grid gap-4 rounded-lg bg-white p-5 shadow-card md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="School URN" value={schoolURN} onChange={setSchoolURN} />
          <Field label="Login ID" value={loginID} onChange={setLoginID} />
          <Field label="Temporary password" value={password} onChange={setPassword} type="password" />
          <button onClick={signIn} disabled={!schoolURN || !loginID || !password || saving} className="btn-pop self-end bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">
            Sign in
          </button>
        </section>

        <div className="mt-4"><WorkspaceState tone={saving ? "loading" : portal ? "success" : "neutral"}>{message}</WorkspaceState></div>
        {portal?.current_user && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#17233f] px-4 py-3 text-sm font-semibold text-white">
            <p>Signed in as {portal.current_user.display_name || portal.current_user.login_id} / {portal.current_user.role === "school_admin" ? "School admin" : "Teacher"}</p>
            <button onClick={logout} className="rounded-lg bg-white px-3 py-2 text-xs text-[#17233f]">Sign out</button>
          </div>
        )}

        {portal?.current_user ? <>
        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {totals.map(([label, value]) => (
            <article key={label} className="rounded-lg bg-white p-5 shadow-card">
              <p className="font-display text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-[#17233f]/58">{label}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-6">
            <Panel id="school-people" title="Classes">
              {(portal?.classes ?? []).map((item) => (
                <Row key={item.id} title={item.name} meta={`Year ${item.year_group}`} body={`${(item.students ?? []).length} pupils / ID ${item.id}`} onClick={() => {
                  setClassDraft({ ...item });
                  setAssignment({ ...assignment, class_id: item.id ?? "" });
                  setGroup({ ...group, class_id: item.id ?? "" });
                }} />
              ))}
            </Panel>
            <Panel title="Pupil Login Packs" action={credentials.length > 0 ? <button onClick={() => window.print()} className="btn-pop bg-[#17233f] px-4 py-2 text-xs text-white">Print cards</button> : null}>
              {credentials.length > 0 && (
                <div className="no-print border-b border-[#17233f]/10 bg-[#fbfaf6] p-5 text-sm leading-6 text-[#17233f]/66">
                  Print cards gives each pupil a simple login code and picture password. Keep cards inside the classroom or send them through approved parent channels.
                </div>
              )}
              {credentials.map((credential) => (
                <article key={credential.student_external_ref} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold">{credential.display_name || credential.student_external_ref}</p>
                    <span className="rounded-lg bg-[#55cbd3]/20 px-3 py-1 text-xs font-semibold text-[#155d64]">{credential.login_code}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#17233f]/58">{credential.picture_password.join(" / ")}</p>
                </article>
              ))}
              {credentials.length === 0 && (
                <div className="p-5 text-sm leading-6 text-[#17233f]/58">
                  Generate class logins after adding pupils to a class.
                </div>
              )}
            </Panel>
            <Panel id="school-learning" title="Active Learning Assignments">
              {learningAssignments.filter((item) => item.status === "active").map((item) => (
                <Row
                  key={item.id}
                  title={item.title}
                  meta={`${item.student_display_name || item.student_external_ref} / priority ${item.priority}`}
                  body={`${item.objective_id}${item.due_at ? ` / due ${new Date(item.due_at).toLocaleDateString()}` : ""}`}
                />
              ))}
              {learningAssignments.filter((item) => item.status === "active").length === 0 && (
                <div className="p-5 text-sm leading-6 text-[#17233f]/58">
                  Teachers can place a curriculum objective into a pupil&apos;s adaptive queue.
                </div>
              )}
            </Panel>
            <Panel id="school-support" title="Active Interventions">
              {interventions.filter((item) => item.status === "active" || item.status === "monitoring").map((item) => (
                <Row
                  key={item.id}
                  title={item.title}
                  meta={`${item.student_display_name || item.student_external_ref} / priority ${item.priority}`}
                  body={`${item.need} Strategy: ${item.strategy}`}
                  action={item.id ? (
                    <button
                      onClick={() => setReviewDraft({
                        intervention_id: item.id!,
                        outcome: item.status === "monitoring" ? "complete" : "monitor",
                        evidence_note: "",
                        next_review_due_at: "",
                      })}
                      className="rounded-lg bg-[#55cbd3]/20 px-3 py-2 text-xs font-semibold text-[#155d64]"
                    >
                      Review evidence
                    </button>
                  ) : null}
                />
              ))}
              {interventions.length === 0 && <div className="p-5 text-sm text-[#17233f]/58">No intervention plans recorded.</div>}
            </Panel>
            <Panel title="Intervention Reassessment History">
              {interventionReviews.slice(0, 12).map((review) => (
                <Row
                  key={review.id}
                  title={`${review.student_display_name || review.student_external_ref}: ${review.outcome}`}
                  meta={review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : "review"}
                  body={`${review.objective_id || "Objective"} / ${review.evidence_note}${review.next_review_due_at ? ` / next review ${new Date(review.next_review_due_at).toLocaleDateString()}` : ""}`}
                />
              ))}
              {interventionReviews.length === 0 && <div className="p-5 text-sm text-[#17233f]/58">No reassessment records yet.</div>}
            </Panel>
            <Panel title="Moderated Teacher Evidence">
              {teacherEvidence.slice(0, 12).map((item) => (
                <Row
                  key={item.id}
                  title={`${item.student_display_name || item.student_external_ref}: ${item.outcome.replaceAll("_", " ")}`}
                  meta={item.evidence_type.replaceAll("_", " ")}
                  body={`${item.objective_id} / ${item.note}`}
                />
              ))}
              {teacherEvidence.length === 0 && <div className="p-5 text-sm text-[#17233f]/58">No moderated evidence recorded.</div>}
            </Panel>
          </div>

          <div className="grid gap-6">
            <Panel title="Create Pupil">
              <Field label="Pupil ID" value={student.external_ref} onChange={(external_ref) => setStudent({ ...student, external_ref: slug(external_ref) })} />
              <Field label="Display name" value={student.display_name} onChange={(display_name) => setStudent({ ...student, display_name })} />
              <Field label="Year group" type="number" value={student.year_group} onChange={(year_group) => setStudent({ ...student, year_group: Number(year_group) })} />
              <Actions label="Create pupil" disabled={!isSchoolAdmin || !student.external_ref || !student.display_name || saving} onClick={saveStudent} />
            </Panel>
            <Panel title="SENCO Pupil Support Profile">
              <LabeledSelect
                label="Selected school learner"
                value={engagementPupil}
                values={["", ...schoolStudents.map((item) => item.external_ref)]}
                labels={schoolStudentLabels}
                onChange={(studentExternalRef) => {
                  const scopedStudentRef = schoolStudents.some((item) => item.external_ref === studentExternalRef) ? studentExternalRef : "";
                  setEngagementPupil(scopedStudentRef);
                  setEngagementProfile(emptyEngagementProfile(scopedStudentRef));
                  setEngagementInterests("");
                  clearProgressReport();
                  setLearningAssignment((current) => ({ ...current, student_external_ref: scopedStudentRef }));
                  setEvidenceDraft((current) => ({ ...current, student_external_ref: scopedStudentRef }));
                  setInterventionDraft((current) => ({ ...current, student_external_ref: scopedStudentRef }));
                }}
              />
              <div className="flex justify-end border-b border-[#17233f]/10 p-5">
                <button onClick={loadEngagementProfile} disabled={!selectedEngagementStudent || saving} className="btn-pop bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50">Load profile</button>
              </div>
              <ChoiceGrid
                label="Declared support needs"
                values={supportNeeds}
                selected={engagementProfile.declared_support_needs}
                onChange={(declared_support_needs) => setEngagementProfile({ ...engagementProfile, declared_support_needs })}
              />
              <ChoiceGrid
                label="Learning and access approaches"
                hint="These settings can adapt presentation and controls at runtime without changing the curriculum objective."
                values={learningApproaches}
                selected={engagementProfile.learning_approaches}
                onChange={(learning_approaches) => setEngagementProfile({ ...engagementProfile, learning_approaches })}
              />
              <div className="grid md:grid-cols-2">
                <LabeledSelect label="Session length" value={engagementProfile.session_length} values={["short", "standard", "extended"]} onChange={(session_length) => setEngagementProfile({ ...engagementProfile, session_length })} />
                <LabeledSelect label="Sensory load" value={engagementProfile.sensory_load} values={["low", "balanced", "high"]} onChange={(sensory_load) => setEngagementProfile({ ...engagementProfile, sensory_load })} />
                <LabeledSelect label="Attention support" value={engagementProfile.attention_support} values={["standard", "chunked", "high_structure"]} onChange={(attention_support) => setEngagementProfile({ ...engagementProfile, attention_support })} />
                <LabeledSelect label="Communication support" value={engagementProfile.communication_support} values={["standard", "visual", "audio_visual"]} onChange={(communication_support) => setEngagementProfile({ ...engagementProfile, communication_support })} />
                <LabeledSelect label="Processing support" value={engagementProfile.processing_support} values={["standard", "extra_time", "step_by_step"]} onChange={(processing_support) => setEngagementProfile({ ...engagementProfile, processing_support })} />
                <LabeledSelect label="Confidence support" value={engagementProfile.confidence_support} values={["gentle", "balanced", "challenge"]} onChange={(confidence_support) => setEngagementProfile({ ...engagementProfile, confidence_support })} />
                <LabeledSelect label="Celebrations" value={engagementProfile.celebration_intensity} values={["quiet", "balanced", "big"]} onChange={(celebration_intensity) => setEngagementProfile({ ...engagementProfile, celebration_intensity })} />
                <LabeledSelect label="Companion style" value={engagementProfile.companion_style} values={["friendly", "funny", "calm", "coach"]} onChange={(companion_style) => setEngagementProfile({ ...engagementProfile, companion_style })} />
                <LabeledSelect label="Reward style" value={engagementProfile.reward_style} values={["world_building", "collecting", "story", "challenge"]} onChange={(reward_style) => setEngagementProfile({ ...engagementProfile, reward_style })} />
              </div>
              <div className="grid border-y border-[#17233f]/10 md:grid-cols-2">
                <BooleanField label="Audio support" checked={engagementProfile.audio_support} onChange={(audio_support) => setEngagementProfile({ ...engagementProfile, audio_support })} />
                <BooleanField label="Reading support" checked={engagementProfile.reading_support} onChange={(reading_support) => setEngagementProfile({ ...engagementProfile, reading_support })} />
              </div>
              <section className="p-5" aria-label="Runtime adaptation preview">
                <div className="rounded-2xl border border-[#55cbd3]/35 bg-[#f3fbfc] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xs uppercase tracking-[0.16em] text-[#155d64]">Runtime adaptation preview</p>
                      <h3 className="font-display mt-1 text-xl font-semibold text-[#17233f]">What this changes for the child</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-[#17233f]/68">
                        This preview translates SENCO choices into the mission behaviours the learner will actually experience.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#55cbd3]/18 px-4 py-2 text-sm font-semibold text-[#155d64]">
                      {runtimePreview.length || "No"} active adaptation{runtimePreview.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {runtimePreview.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {runtimePreview.map(([title, detail]) => (
                        <article key={`${title}-${detail}`} className="rounded-2xl border border-[#17233f]/10 bg-white p-4">
                          <p className="font-display text-sm font-semibold text-[#17233f]">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#17233f]/68">{detail}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#17233f]/68">
                      Select support approaches above to preview the runtime changes before saving the profile.
                    </p>
                  )}
                </div>
              </section>
              <Field label="Interests (comma separated)" value={engagementInterests} onChange={setEngagementInterests} />
              <TextArea label="Operational notes" value={engagementProfile.notes} onChange={(notes) => setEngagementProfile({ ...engagementProfile, notes })} />
              {engagementProfile.updated_at && <p className="px-5 pb-2 text-xs text-[#17233f]/52">Last updated {new Date(engagementProfile.updated_at).toLocaleString()}</p>}
              <Actions label="Save support profile" disabled={!selectedEngagementStudent || saving} onClick={saveEngagementProfile} />
            </Panel>
            <Panel title="Learner Progress Snapshot">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="max-w-xl text-sm leading-6 text-[#17233f]/62">
                  {selectedEngagementStudent
                    ? `Showing ${selectedEngagementStudent.display_name} (${selectedEngagementStudent.external_ref}). Progress is subject-specific, so Mathematics can stretch while English remains on its own support route.`
                    : "Choose a pupil above. Progress is subject-specific: a pupil may work ahead in Mathematics while English remains on its own support route."}
                </p>
                <button onClick={loadProgressReport} disabled={!selectedEngagementStudent || saving} className="btn-pop bg-[#7357c9] px-5 py-3 text-sm text-white disabled:opacity-50">Load progress</button>
              </div>
              <div className="[&_p]:!text-[#42506b]">
                <ProgressSnapshot progress={progressReport} tone="navy" empty="Choose a pupil above, then load their progress evidence." />
                <AttemptEvidencePanel items={progressReport?.attempt_evidence} />
              </div>
              {selectedEngagementStudent && (
                <div className="border-t border-[#17233f]/10 p-5">
                  <MockAssessmentHistory
                    role="school"
                    studentId={selectedEngagementStudent.external_ref}
                    studentName={selectedEngagementStudent.display_name}
                  />
                </div>
              )}
            </Panel>
            <Panel title="Create Class">
              <Field label="Class ID" value={classDraft.id ?? ""} onChange={(id) => setClassDraft({ ...classDraft, id: slug(id) })} />
              <Field label="Class name" value={classDraft.name} onChange={(name) => setClassDraft({ ...classDraft, name })} />
              <Field label="Year group" type="number" value={classDraft.year_group} onChange={(year_group) => setClassDraft({ ...classDraft, year_group: Number(year_group) })} />
              <Actions label="Save class" disabled={!isSchoolAdmin || !classDraft.name || saving} onClick={saveClass} />
            </Panel>
            <Panel title="Class Access">
              <Field label="Class ID" value={assignment.class_id} onChange={(class_id) => setAssignment({ ...assignment, class_id })} />
              <Field label="Pupil ID" value={assignment.student_external_ref} onChange={(student_external_ref) => setAssignment({ ...assignment, student_external_ref: slug(student_external_ref) })} />
              <div className="flex flex-wrap justify-end gap-3 p-5">
                <button onClick={assignStudent} disabled={!isSchoolAdmin || !assignment.class_id || !assignment.student_external_ref || saving} className="btn-pop bg-[#55cbd3] px-5 py-3 text-sm disabled:opacity-50">Add pupil</button>
                <button onClick={() => generateCredentials(assignment.class_id)} disabled={!isSchoolAdmin || !assignment.class_id || saving} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">Generate logins</button>
              </div>
            </Panel>
            <Panel title="Teaching Group">
              <Field label="Group ID" value={group.id ?? ""} onChange={(id) => setGroup({ ...group, id: slug(id) })} />
              <Field label="Class ID" value={group.class_id} onChange={(class_id) => setGroup({ ...group, class_id })} />
              <Field label="Group name" value={group.name} onChange={(name) => setGroup({ ...group, name })} />
              <PurposeSelect value={group.purpose} values={["intervention", "challenge", "phonics", "fluency", "senco", "teacher-defined"]} onChange={(purpose) => setGroup({ ...group, purpose })} />
              <Actions label="Save group" disabled={!group.class_id || !group.name || saving} onClick={saveGroup} />
            </Panel>
            <Panel title="Assign Learning Priority">
              <LearnerScopeNotice purpose="assignment" learner={selectedEngagementStudent} />
              <Field label="Objective ID" value={learningAssignment.objective_id} onChange={(objective_id) => setLearningAssignment({ ...learningAssignment, objective_id })} />
              <Field label="Activity ID (optional)" value={learningAssignment.activity_id ?? ""} onChange={(activity_id) => setLearningAssignment({ ...learningAssignment, activity_id })} />
              <Field label="Teacher note/title" value={learningAssignment.title} onChange={(title) => setLearningAssignment({ ...learningAssignment, title })} />
              <Field label="Priority 1-100" type="number" value={learningAssignment.priority} onChange={(priority) => setLearningAssignment({ ...learningAssignment, priority: Number(priority) })} />
              <Field label="Due date (optional)" type="datetime-local" value={learningAssignment.due_at ?? ""} onChange={(due_at) => setLearningAssignment({ ...learningAssignment, due_at })} />
              <Actions
                label="Assign learning"
                disabled={!learningAssignment.student_external_ref || !learningAssignment.objective_id || !learningAssignment.title || saving}
                onClick={saveLearningAssignment}
              />
            </Panel>
            <Panel title="Generate Subject Mock">
              <LearnerScopeNotice purpose="mock" learner={selectedEngagementStudent} />
              {(() => {
                const target = (portal?.classes ?? []).flatMap((item) => item.students ?? []).find((item) => item.external_ref === learningAssignment.student_external_ref);
                return target ? (
                  <div className="p-5 pt-0">
                    <MockAssessmentBuilder key={`school:${target.external_ref}:${target.year_group}`} role="school" studentId={target.external_ref} studentName={target.display_name} yearGroup={target.year_group} />
                  </div>
                ) : <p className="px-5 pb-5 text-sm leading-6 text-[#17233f]/58">Enter a pupil ID that belongs to this school to generate a scoped subject mock.</p>;
              })()}
            </Panel>
            <Panel title="Record Teacher Evidence">
              <LearnerScopeNotice purpose="teacher evidence" learner={selectedEngagementStudent} />
              <Field label="Objective ID" value={evidenceDraft.objective_id} onChange={(objective_id) => setEvidenceDraft({ ...evidenceDraft, objective_id })} />
              <LabeledSelect label="Evidence type" value={evidenceDraft.evidence_type} values={["observation", "work_sample", "conversation", "assessment", "external"]} onChange={(evidence_type) => setEvidenceDraft({ ...evidenceDraft, evidence_type })} />
              <LabeledSelect label="Outcome" value={evidenceDraft.outcome} values={["secure", "developing", "needs_support", "inconclusive"]} onChange={(outcome) => setEvidenceDraft({ ...evidenceDraft, outcome })} />
              <Field label="Evidence note" value={evidenceDraft.note} onChange={(note) => setEvidenceDraft({ ...evidenceDraft, note })} />
              <Field label="Source reference (optional)" value={evidenceDraft.source_ref ?? ""} onChange={(source_ref) => setEvidenceDraft({ ...evidenceDraft, source_ref })} />
              <Actions label="Save teacher evidence" disabled={!evidenceDraft.student_external_ref || !evidenceDraft.objective_id || !evidenceDraft.note || saving} onClick={saveTeacherEvidence} />
            </Panel>
            <Panel title="Create Intervention Plan">
              <LearnerScopeNotice purpose="intervention" learner={selectedEngagementStudent} />
              <Field label="Objective ID" value={interventionDraft.objective_id} onChange={(objective_id) => setInterventionDraft({ ...interventionDraft, objective_id })} />
              <Field label="Plan title" value={interventionDraft.title} onChange={(title) => setInterventionDraft({ ...interventionDraft, title })} />
              <Field label="Identified learning need" value={interventionDraft.need} onChange={(need) => setInterventionDraft({ ...interventionDraft, need })} />
              <Field label="Teaching strategy" value={interventionDraft.strategy} onChange={(strategy) => setInterventionDraft({ ...interventionDraft, strategy })} />
              <Field label="Priority 1-100" type="number" value={interventionDraft.priority} onChange={(priority) => setInterventionDraft({ ...interventionDraft, priority: Number(priority) })} />
              <Field label="Review date (optional)" type="datetime-local" value={interventionDraft.review_due_at ?? ""} onChange={(review_due_at) => setInterventionDraft({ ...interventionDraft, review_due_at })} />
              <Actions label="Create intervention" disabled={!interventionDraft.student_external_ref || !interventionDraft.objective_id || !interventionDraft.title || !interventionDraft.need || !interventionDraft.strategy || saving} onClick={saveIntervention} />
            </Panel>
            <Panel title="Review Intervention Evidence">
              <LabeledSelect
                label="Intervention"
                value={reviewDraft.intervention_id}
                values={["", ...interventions.filter((item) => item.id).map((item) => item.id!)]}
                labels={Object.fromEntries(interventions.filter((item) => item.id).map((item) => [item.id!, `${item.student_display_name || item.student_external_ref}: ${item.title}`]))}
                onChange={(intervention_id) => setReviewDraft({ ...reviewDraft, intervention_id })}
              />
              <LabeledSelect label="Review outcome" value={reviewDraft.outcome} values={["continue", "monitor", "complete", "reopen"]} onChange={(outcome) => setReviewDraft({ ...reviewDraft, outcome: outcome as InterventionReview["outcome"] })} />
              <Field label="Reassessment evidence" value={reviewDraft.evidence_note} onChange={(evidence_note) => setReviewDraft({ ...reviewDraft, evidence_note })} />
              <Field label="Next review date" type="datetime-local" value={reviewDraft.next_review_due_at ?? ""} onChange={(next_review_due_at) => setReviewDraft({ ...reviewDraft, next_review_due_at })} />
              <Actions
                label="Save reassessment"
                disabled={!reviewDraft.intervention_id || !reviewDraft.evidence_note || (reviewDraft.outcome !== "complete" && !reviewDraft.next_review_due_at) || saving}
                onClick={saveInterventionReview}
              />
            </Panel>
          </div>
        </section>

        <section className="print-card-sheet mt-8 hidden">
          <div className="mb-5">
            <h2 className="font-display text-3xl font-semibold">NexusLearn pupil login cards</h2>
            <p className="mt-1 text-sm text-[#17233f]/62">{portal?.school?.name ?? "School workspace"} / generated from current credential list</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {credentials.map((credential) => (
              <LoginCard key={`print-${credential.student_external_ref}`} credential={credential} schoolName={portal?.school?.name ?? "NexusLearn"} />
            ))}
          </div>
        </section>
        </> : null}
      </div>
    </main>
  );
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function commaValues(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
