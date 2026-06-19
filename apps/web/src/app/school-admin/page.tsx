"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { accountSessionHeaders, logoutAccount, storeAccountSession, type AccountSession } from "@/lib/api";

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

const API = process.env.NEXT_PUBLIC_API_URL;
const picturePool = ["star", "book", "sun", "tree", "rocket", "moon", "shell", "key"];

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
  const credentials = portal?.student_credentials ?? [];
  const isSchoolAdmin = portal?.current_user?.role === "school_admin";

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

  async function apiFetch(path: string, options: RequestInit = {}) {
    if (!API) throw new Error("API is not configured.");
    const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers(), ...(options.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Request failed.");
    return body;
  }

  async function load() {
    await guarded("Loading school workspace...", async () => {
      const data = await apiFetch("/v1/school/config");
      setPortal(data as SchoolPortal);
      const assignmentData = await apiFetch("/v1/school/assignments");
      setLearningAssignments(assignmentData.assignments ?? []);
      const evidenceData = await apiFetch("/v1/school/evidence");
      setTeacherEvidence(evidenceData.teacher_evidence ?? []);
      const interventionData = await apiFetch("/v1/school/interventions");
      setInterventions(interventionData.interventions ?? []);
      const reviewData = await apiFetch("/v1/school/intervention-reviews");
      setInterventionReviews(reviewData.intervention_reviews ?? []);
      setMessage("School workspace loaded.");
    });
  }

  async function signIn() {
    await guarded("Signing in...", async () => {
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
      const data = await apiFetch("/v1/school/config");
      setPortal(data as SchoolPortal);
      const assignmentData = await apiFetch("/v1/school/assignments");
      setLearningAssignments(assignmentData.assignments ?? []);
      const evidenceData = await apiFetch("/v1/school/evidence");
      setTeacherEvidence(evidenceData.teacher_evidence ?? []);
      const interventionData = await apiFetch("/v1/school/interventions");
      setInterventions(interventionData.interventions ?? []);
      const reviewData = await apiFetch("/v1/school/intervention-reviews");
      setInterventionReviews(reviewData.intervention_reviews ?? []);
      setMessage("School workspace loaded.");
    });
  }

  async function logout() {
    await logoutAccount();
    setPortal(null);
    setMessage("Signed out securely.");
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

        <section className="mt-8 grid gap-4 rounded-lg bg-white p-5 shadow-card md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="School URN" value={schoolURN} onChange={setSchoolURN} />
          <Field label="Login ID" value={loginID} onChange={setLoginID} />
          <Field label="Temporary password" value={password} onChange={setPassword} type="password" />
          <button onClick={signIn} disabled={!schoolURN || !loginID || !password || saving} className="btn-pop self-end bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">
            Sign in
          </button>
        </section>

        <p className="mt-4 rounded-lg bg-white/72 px-4 py-3 text-sm text-[#17233f]/66">{message}</p>
        {portal?.current_user && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#17233f] px-4 py-3 text-sm font-semibold text-white">
            <p>Signed in as {portal.current_user.display_name || portal.current_user.login_id} / {portal.current_user.role === "school_admin" ? "School admin" : "Teacher"}</p>
            <button onClick={logout} className="rounded-lg bg-white px-3 py-2 text-xs text-[#17233f]">Sign out</button>
          </div>
        )}

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
            <Panel title="Classes">
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
            <Panel title="Active Learning Assignments">
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
                  Teachers can place a curriculum objective into a pupil's adaptive queue.
                </div>
              )}
            </Panel>
            <Panel title="Active Interventions">
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
              <Select value={group.purpose} values={["intervention", "challenge", "phonics", "fluency", "senco", "teacher-defined"]} onChange={(purpose) => setGroup({ ...group, purpose })} />
              <Actions label="Save group" disabled={!group.class_id || !group.name || saving} onClick={saveGroup} />
            </Panel>
            <Panel title="Assign Learning Priority">
              <Field label="Pupil ID" value={learningAssignment.student_external_ref} onChange={(student_external_ref) => setLearningAssignment({ ...learningAssignment, student_external_ref: slug(student_external_ref) })} />
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
            <Panel title="Record Teacher Evidence">
              <Field label="Pupil ID" value={evidenceDraft.student_external_ref} onChange={(student_external_ref) => setEvidenceDraft({ ...evidenceDraft, student_external_ref: slug(student_external_ref) })} />
              <Field label="Objective ID" value={evidenceDraft.objective_id} onChange={(objective_id) => setEvidenceDraft({ ...evidenceDraft, objective_id })} />
              <LabeledSelect label="Evidence type" value={evidenceDraft.evidence_type} values={["observation", "work_sample", "conversation", "assessment", "external"]} onChange={(evidence_type) => setEvidenceDraft({ ...evidenceDraft, evidence_type })} />
              <LabeledSelect label="Outcome" value={evidenceDraft.outcome} values={["secure", "developing", "needs_support", "inconclusive"]} onChange={(outcome) => setEvidenceDraft({ ...evidenceDraft, outcome })} />
              <Field label="Evidence note" value={evidenceDraft.note} onChange={(note) => setEvidenceDraft({ ...evidenceDraft, note })} />
              <Field label="Source reference (optional)" value={evidenceDraft.source_ref ?? ""} onChange={(source_ref) => setEvidenceDraft({ ...evidenceDraft, source_ref })} />
              <Actions label="Save teacher evidence" disabled={!evidenceDraft.student_external_ref || !evidenceDraft.objective_id || !evidenceDraft.note || saving} onClick={saveTeacherEvidence} />
            </Panel>
            <Panel title="Create Intervention Plan">
              <Field label="Pupil ID" value={interventionDraft.student_external_ref} onChange={(student_external_ref) => setInterventionDraft({ ...interventionDraft, student_external_ref: slug(student_external_ref) })} />
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
      </div>
    </main>
  );
}

function Panel({ title, children, action = null }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-[#17233f]/10 p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {action}
      </div>
      <div className="divide-y divide-[#17233f]/10">{children}</div>
    </section>
  );
}

function LoginCard({ credential, schoolName }: { credential: StudentCredential; schoolName: string }) {
  const picturePassword = credential.picture_password ?? [];
  const loginURL = loginCardURL(credential);
  return (
    <article className="break-inside-avoid rounded-lg border-2 border-[#17233f] bg-white p-5 text-[#17233f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.16em] text-[#7357c9]">NexusLearn</p>
          <h3 className="font-display mt-1 text-2xl font-semibold">{credential.display_name || credential.student_external_ref}</h3>
          <p className="mt-1 text-xs text-[#17233f]/56">{schoolName}</p>
        </div>
        <QRCodeMark value={loginURL} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Info label="Login code" value={credential.login_code || "Picture login"} />
        <Info label="Pupil ID" value={credential.student_external_ref} />
      </div>

      <div className="mt-4 rounded-lg bg-[#f7f0df] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#17233f]/50">Picture password</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {picturePassword.length > 0 ? picturePassword.map((item, index) => (
            <span key={`${item}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-sm">{labelForPicture(item)}</span>
          )) : (
            <span className="text-sm text-[#17233f]/58">Use the login code shown above.</span>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-[#17233f]/58">Scan the QR code or go to NexusLearn, enter the code, then choose the pictures in order. Do not share this card outside the learner's trusted adults.</p>
    </article>
  );
}

function QRCodeMark({ value }: { value: string }) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(x, y)) cells.push([x, y]);
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-24 w-24 shrink-0 rounded-lg border border-[#17233f]/20 bg-white p-1" role="img" aria-label="QR login code">
      <rect width={size} height={size} fill="#ffffff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#17233f" />)}
    </svg>
  );
}

function loginCardURL(credential: StudentCredential) {
  const params = new URLSearchParams({
    pupil: credential.student_external_ref,
    code: credential.login_code || "",
  });
  if (credential.qr_secret_hash) params.set("card", credential.qr_secret_hash);
  return `https://nexuslearn-woad.vercel.app/login?${params.toString()}`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#17233f]/12 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#17233f]/48">{label}</p>
      <p className="mt-1 break-words font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

function labelForPicture(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password" | "datetime-local" }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]" />
    </label>
  );
}

function Select({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">Purpose</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function LabeledSelect({ label, value, values, labels = {}, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#17233f]/70">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#17233f]/14 px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item || "blank"} value={item}>{labels[item] || item.replaceAll("_", " ") || "Select..."}</option>)}
      </select>
    </label>
  );
}

function Row({ title, meta, body, onClick, action = null }: { title: string; meta: string; body: string; onClick?: () => void; action?: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-4 p-5 text-left hover:bg-[#f7f0df]">
      <button onClick={onClick} disabled={!onClick} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{title}</p>
          <span className="rounded-lg bg-[#7357c9]/12 px-3 py-1 text-xs font-semibold text-[#4d3690]">{meta}</span>
        </div>
        <p className="mt-2 text-sm text-[#17233f]/58">{body}</p>
      </button>
      {action}
    </div>
  );
}

function Actions({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end p-5">
      <button onClick={onClick} disabled={disabled} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm disabled:opacity-50">{label}</button>
    </div>
  );
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
