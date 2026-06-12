"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

type FeatureFlag = { key: string; enabled: boolean; description: string; config?: Record<string, unknown>; updated_at?: string };
type World = { key: string; name: string; year_group: number; theme: string; config?: Record<string, unknown>; enabled: boolean };
type Activity = {
  id: string;
  objective_id: string;
  template_id: string;
  world_key: string;
  title: string;
  prompt: string;
  difficulty: number;
  interaction?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  animation_hooks?: Record<string, unknown>;
  status: string;
};
type Question = {
  id: string;
  activity_id: string;
  objective_id: string;
  format: string;
  body?: Record<string, unknown>;
  expected_answer?: Record<string, unknown>;
  hints?: string[];
  explanation: string;
  difficulty: number;
  status: string;
};
type RewardRule = {
  id: string;
  world_key: string;
  objective_id: string;
  trigger: string;
  reward_payload?: Record<string, unknown>;
  enabled: boolean;
  updated_at?: string;
};
type StudentProfile = {
  id?: string;
  external_ref: string;
  display_name: string;
  year_group: number;
  created_at?: string;
  updated_at?: string;
};
type School = {
  id?: string;
  name: string;
  urn: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};
type ClassGroup = {
  id?: string;
  school_id?: string;
  school_urn: string;
  school_name?: string;
  name: string;
  year_group: number;
  students?: StudentProfile[];
  created_at?: string;
  updated_at?: string;
};
type StudentCredential = {
  student_external_ref: string;
  display_name?: string;
  login_code: string;
  picture_password: string[];
  qr_secret_hash?: string;
  updated_at?: string;
};
type Objective = {
  id: string;
  year: number;
  subject: string;
  strand: string;
  topic: string;
  statement: string;
  prerequisites: string[];
  misconceptions: string[];
  mastery: { expected: number; secure: number; retention_days: number[]; required_formats: string[] };
  parent_explanation: string;
  teacher_evidence: string;
};
type AuditLog = { id: string; action: string; entity_type: string; entity_id: string; created_at: string };

type AdminConfig = {
  feature_flags?: FeatureFlag[];
  worlds?: World[];
  activities?: Activity[];
  questions?: Question[];
  reward_rules?: RewardRule[];
  students?: StudentProfile[];
  schools?: School[];
  classes?: ClassGroup[];
  student_credentials?: StudentCredential[];
};

const API = process.env.NEXT_PUBLIC_API_URL;
const EMPTY_OBJECT = "{}";
const EMPTY_ARRAY = "[]";
const TABS = ["Schools", "Learners", "Worlds", "Activities", "Questions", "Rewards", "Objectives", "Flags", "Audit"] as const;
type Tab = (typeof TABS)[number];

const newWorld: World = {
  key: "",
  name: "",
  year_group: 0,
  theme: "",
  config: {},
  enabled: true,
};

const newActivity: Activity = {
  id: "",
  objective_id: "",
  template_id: "",
  world_key: "",
  title: "",
  prompt: "",
  difficulty: 1,
  interaction: {},
  feedback: {},
  animation_hooks: {},
  status: "draft",
};

const newQuestion: Question = {
  id: "",
  activity_id: "",
  objective_id: "",
  format: "",
  body: {},
  expected_answer: {},
  hints: [],
  explanation: "",
  difficulty: 1,
  status: "draft",
};

const newRewardRule: RewardRule = {
  id: "",
  world_key: "",
  objective_id: "",
  trigger: "attempt.correct",
  reward_payload: {
    reward_hook: "",
    animation_hook: "",
    feedback: "",
    explanation: "",
    evidence_event: "",
    companion_prompt: "",
  },
  enabled: true,
};

const newStudent: StudentProfile = {
  external_ref: "",
  display_name: "",
  year_group: 1,
};

const newSchool: School = {
  name: "",
  urn: "",
  status: "trial",
};

const newClassGroup: ClassGroup = {
  school_urn: "",
  name: "",
  year_group: 1,
  students: [],
};

const newCredential: StudentCredential = {
  student_external_ref: "",
  login_code: "",
  picture_password: [],
  qr_secret_hash: "",
};

const newObjective: Objective = {
  id: "",
  year: 0,
  subject: "",
  strand: "",
  topic: "",
  statement: "",
  prerequisites: [],
  misconceptions: [],
  mastery: { expected: 80, secure: 90, retention_days: [], required_formats: [] },
  parent_explanation: "",
  teacher_evidence: "",
};

const newFlag: FeatureFlag = {
  key: "",
  enabled: false,
  description: "",
  config: {},
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("Enter the Render ADMIN_API_KEY to load and edit platform configuration.");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [tab, setTab] = useState<Tab>("Worlds");

  const [worldDraft, setWorldDraft] = useState({ ...newWorld, configText: pretty(newWorld.config) });
  const [activityDraft, setActivityDraft] = useState({
    ...newActivity,
    interactionText: pretty(newActivity.interaction),
    feedbackText: pretty(newActivity.feedback),
    animationHooksText: pretty(newActivity.animation_hooks),
  });
  const [questionDraft, setQuestionDraft] = useState({
    ...newQuestion,
    bodyText: pretty(newQuestion.body),
    expectedText: pretty(newQuestion.expected_answer),
    hintsText: pretty(newQuestion.hints),
  });
  const [rewardDraft, setRewardDraft] = useState({ ...newRewardRule, rewardPayloadText: pretty(newRewardRule.reward_payload) });
  const [studentDraft, setStudentDraft] = useState({ ...newStudent });
  const [schoolDraft, setSchoolDraft] = useState({ ...newSchool });
  const [classDraft, setClassDraft] = useState({ ...newClassGroup });
  const [credentialDraft, setCredentialDraft] = useState({ ...newCredential, picturePasswordText: pretty(newCredential.picture_password) });
  const [assignmentDraft, setAssignmentDraft] = useState({ class_id: "", student_external_ref: "" });
  const [objectiveDraft, setObjectiveDraft] = useState({
    ...newObjective,
    prerequisitesText: pretty(newObjective.prerequisites),
    misconceptionsText: pretty(newObjective.misconceptions),
    retentionDaysText: pretty(newObjective.mastery.retention_days),
    requiredFormatsText: pretty(newObjective.mastery.required_formats),
  });
  const [flagDraft, setFlagDraft] = useState({ ...newFlag, configText: pretty(newFlag.config) });

  const totals = useMemo(
    () => [
      { label: "Worlds", value: config?.worlds?.length ?? 0 },
      { label: "Learners", value: config?.students?.length ?? 0 },
      { label: "Classes", value: config?.classes?.length ?? 0 },
      { label: "Activities", value: config?.activities?.length ?? 0 },
    ],
    [config, objectives],
  );

  async function adminFetch(path: string, options: RequestInit = {}) {
    if (!API) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    const headers = new Headers(options.headers);
    headers.set("X-Admin-Key", adminKey);
    if (options.body) headers.set("Content-Type", "application/json");
    const res = await fetch(`${API}${path}`, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Admin request failed.");
    return body;
  }

  async function loadConfig() {
    setLoading(true);
    setMessage("Loading live configuration...");
    try {
      const [loadedConfig, objectiveData, auditData] = await Promise.all([
        adminFetch("/v1/admin/config"),
        fetch(`${API}/v1/curriculum/objectives`).then((res) => res.json()),
        adminFetch("/v1/admin/audit"),
      ]);
      setConfig(loadedConfig as AdminConfig);
      setObjectives(objectiveData.objectives ?? []);
      setAuditLogs(auditData.audit_logs ?? []);
      setMessage("Live configuration loaded. Select a row to edit, or create a new item.");
    } catch (error) {
      setConfig(null);
      setMessage(error instanceof Error ? error.message : "Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  async function saveWorld() {
    await guardedSave(async () => {
      const configBody = parseJSON<Record<string, unknown>>(worldDraft.configText, EMPTY_OBJECT, "world config");
      requireText(worldDraft.key, "World key");
      requireText(worldDraft.name, "World name");
      requireText(worldDraft.theme, "World theme");
      requireRange(Number(worldDraft.year_group), 0, 7, "World year group");
      await save(`/v1/admin/worlds/${worldDraft.key}`, {
        key: worldDraft.key,
        name: worldDraft.name,
        year_group: Number(worldDraft.year_group) || 0,
        theme: worldDraft.theme,
        enabled: worldDraft.enabled,
        config: configBody,
      });
    });
  }

  async function saveActivity() {
    await guardedSave(async () => {
      const difficulty = Number(activityDraft.difficulty);
      requireText(activityDraft.id, "Activity ID");
      requireText(activityDraft.objective_id, "Activity objective");
      requireText(activityDraft.world_key, "Activity world");
      requireText(activityDraft.template_id, "Activity template");
      requireText(activityDraft.title, "Activity title");
      requireText(activityDraft.prompt, "Activity prompt");
      requireRange(difficulty, 1, 10, "Activity difficulty");
      await save(`/v1/admin/content/activities/${activityDraft.id}`, {
        id: activityDraft.id,
        objective_id: activityDraft.objective_id,
        template_id: activityDraft.template_id,
        world_key: activityDraft.world_key,
        title: activityDraft.title,
        prompt: activityDraft.prompt,
        difficulty,
        interaction: parseJSON<Record<string, unknown>>(activityDraft.interactionText, EMPTY_OBJECT, "interaction"),
        feedback: parseJSON<Record<string, unknown>>(activityDraft.feedbackText, EMPTY_OBJECT, "feedback"),
        animation_hooks: parseJSON<Record<string, unknown>>(activityDraft.animationHooksText, EMPTY_OBJECT, "animation hooks"),
        status: activityDraft.status,
      });
    });
  }

  async function saveQuestion() {
    await guardedSave(async () => {
      const difficulty = Number(questionDraft.difficulty);
      const body = parseJSON<Record<string, unknown>>(questionDraft.bodyText, EMPTY_OBJECT, "question body");
      const expected = parseJSON<Record<string, unknown>>(questionDraft.expectedText, EMPTY_OBJECT, "expected answer");
      const hints = parseJSON<string[]>(questionDraft.hintsText, EMPTY_ARRAY, "hints");
      requireText(questionDraft.id, "Question ID");
      requireText(questionDraft.objective_id, "Question objective");
      requireText(questionDraft.format, "Question format");
      requireRange(difficulty, 1, 10, "Question difficulty");
      requireObject(body, "Question body");
      requireObject(expected, "Expected answer");
      requireStringArray(hints, "Hints");
      if (["approved", "published", "live"].includes(questionDraft.status)) {
        requireText(questionDraft.activity_id, "Published question activity");
        requireText(questionDraft.explanation, "Published question explanation");
      }
      await save(`/v1/admin/content/questions/${questionDraft.id}`, {
        id: questionDraft.id,
        activity_id: questionDraft.activity_id,
        objective_id: questionDraft.objective_id,
        format: questionDraft.format,
        body,
        expected_answer: expected,
        hints,
        explanation: questionDraft.explanation,
        difficulty,
        status: questionDraft.status,
      });
    });
  }

  async function saveRewardRule() {
    await guardedSave(async () => {
      const payload = parseJSON<Record<string, unknown>>(rewardDraft.rewardPayloadText, EMPTY_OBJECT, "reward payload");
      requireText(rewardDraft.id, "Reward rule ID");
      requireText(rewardDraft.trigger, "Reward trigger");
      requireObject(payload, "Reward payload");
      for (const key of ["reward_hook", "animation_hook", "feedback", "explanation", "evidence_event", "companion_prompt"]) {
        requireText(String(payload[key] ?? ""), `Reward payload ${key}`);
      }
      await save(`/v1/admin/reward-rules/${rewardDraft.id}`, {
        id: rewardDraft.id,
        world_key: rewardDraft.world_key,
        objective_id: rewardDraft.objective_id,
        trigger: rewardDraft.trigger,
        reward_payload: payload,
        enabled: rewardDraft.enabled,
      });
    });
  }

  async function saveStudent() {
    await guardedSave(async () => {
      const yearGroup = Number(studentDraft.year_group);
      requireText(studentDraft.external_ref, "Learner external ref");
      requireText(studentDraft.display_name, "Learner display name");
      requireRange(yearGroup, 1, 7, "Learner year group");
      await save(`/v1/admin/students/${studentDraft.external_ref}`, {
        external_ref: studentDraft.external_ref,
        display_name: studentDraft.display_name,
        year_group: yearGroup,
      });
    });
  }

  async function saveSchool() {
    await guardedSave(async () => {
      requireText(schoolDraft.urn, "School URN");
      requireText(schoolDraft.name, "School name");
      requireText(schoolDraft.status, "School status");
      await save(`/v1/admin/schools/${schoolDraft.urn}`, {
        urn: schoolDraft.urn,
        name: schoolDraft.name,
        status: schoolDraft.status,
      });
    });
  }

  async function saveClassGroup() {
    await guardedSave(async () => {
      const yearGroup = Number(classDraft.year_group);
      requireText(classDraft.school_urn, "Class school URN");
      requireText(classDraft.name, "Class name");
      requireRange(yearGroup, 1, 7, "Class year group");
      await save(`/v1/admin/classes/${classDraft.id || slug(`${classDraft.school_urn}-${classDraft.name}`)}`, {
        school_urn: classDraft.school_urn,
        name: classDraft.name,
        year_group: yearGroup,
      });
    });
  }

  async function assignStudentToClass() {
    await guardedSave(async () => {
      requireText(assignmentDraft.class_id, "Class ID");
      requireText(assignmentDraft.student_external_ref, "Learner external ref");
      await save(`/v1/admin/classes/${assignmentDraft.class_id}/students/${assignmentDraft.student_external_ref}`, {});
    });
  }

  async function saveCredential() {
    await guardedSave(async () => {
      const picturePassword = parseJSON<string[]>(credentialDraft.picturePasswordText, EMPTY_ARRAY, "picture password");
      requireText(credentialDraft.student_external_ref, "Credential learner external ref");
      requireStringArray(picturePassword, "Picture password");
      if (!credentialDraft.login_code.trim() && picturePassword.length === 0) {
        throw new Error("Credential needs a login code or picture password.");
      }
      await save(`/v1/admin/student-credentials/${credentialDraft.student_external_ref}`, {
        student_external_ref: credentialDraft.student_external_ref,
        login_code: credentialDraft.login_code,
        picture_password: picturePassword,
        qr_secret_hash: credentialDraft.qr_secret_hash ?? "",
      });
    });
  }

  async function saveObjective() {
    await guardedSave(async () => {
      const year = Number(objectiveDraft.year);
      const expected = Number(objectiveDraft.mastery.expected);
      const secure = Number(objectiveDraft.mastery.secure);
      const prerequisites = parseJSON<string[]>(objectiveDraft.prerequisitesText, EMPTY_ARRAY, "prerequisites");
      const misconceptions = parseJSON<string[]>(objectiveDraft.misconceptionsText, EMPTY_ARRAY, "misconceptions");
      const retentionDays = parseJSON<number[]>(objectiveDraft.retentionDaysText, EMPTY_ARRAY, "retention days");
      const requiredFormats = parseJSON<string[]>(objectiveDraft.requiredFormatsText, EMPTY_ARRAY, "required formats");
      requireText(objectiveDraft.id, "Objective ID");
      requireRange(year, 1, 7, "Objective year");
      requireText(objectiveDraft.subject, "Objective subject");
      requireText(objectiveDraft.strand, "Objective strand");
      requireText(objectiveDraft.topic, "Objective topic");
      requireText(objectiveDraft.statement, "Objective statement");
      requireText(objectiveDraft.parent_explanation, "Parent explanation");
      requireText(objectiveDraft.teacher_evidence, "Teacher evidence");
      requireRange(expected, 1, 100, "Expected mastery");
      requireRange(secure, expected, 100, "Secure mastery");
      requireStringArray(prerequisites, "Prerequisites");
      requireStringArray(misconceptions, "Misconceptions", true);
      requireNumberArray(retentionDays, "Retention days", true);
      requireStringArray(requiredFormats, "Required formats", true);
      await save(`/v1/admin/curriculum/objectives/${objectiveDraft.id}`, {
        id: objectiveDraft.id,
        year,
        subject: objectiveDraft.subject,
        strand: objectiveDraft.strand,
        topic: objectiveDraft.topic,
        statement: objectiveDraft.statement,
        prerequisites,
        misconceptions,
        mastery: {
          expected,
          secure,
          retention_days: retentionDays,
          required_formats: requiredFormats,
        },
        parent_explanation: objectiveDraft.parent_explanation,
        teacher_evidence: objectiveDraft.teacher_evidence,
      });
    });
  }

  async function saveFlag() {
    await guardedSave(async () => {
      requireText(flagDraft.key, "Feature flag key");
      requireText(flagDraft.description, "Feature flag description");
      await save(`/v1/admin/feature-flags/${flagDraft.key}`, {
        key: flagDraft.key,
        enabled: flagDraft.enabled,
        description: flagDraft.description,
        config: parseJSON<Record<string, unknown>>(flagDraft.configText, EMPTY_OBJECT, "feature flag config"),
      });
    });
  }

  async function save(path: string, body: unknown) {
    try {
      setSaving(path);
      setMessage("Saving...");
      await adminFetch(path, { method: "PUT", body: JSON.stringify(body) });
      setMessage("Saved. Refreshing live configuration...");
      await loadConfig();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving("");
    }
  }

  async function guardedSave(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3ea] px-5 py-8 text-[#1d1a3e]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.18em] text-[#7357c9]">Platform admin</p>
            <h1 className="font-display mt-2 text-4xl font-semibold">Configuration control room</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#1d1a3e]/62">
              Edit curriculum, worlds, activities, questions and feature flags that drive the learner runtime.
            </p>
          </div>
          <Link href="/" className="btn-pop bg-white px-5 py-3 text-sm shadow-card">
            Home
          </Link>
        </div>

        <section className="mt-8 grid gap-4 bg-white p-5 shadow-card md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-semibold">Admin API key</span>
            <input
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              type="password"
              className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]"
              placeholder="X-Admin-Key"
            />
          </label>
          <button
            onClick={loadConfig}
            disabled={loading || !adminKey}
            className="btn-pop self-end bg-[#ffbf45] px-6 py-3 text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading" : "Load config"}
          </button>
        </section>

        <p className="mt-4 bg-white/70 px-4 py-3 text-sm text-[#1d1a3e]/66">{message}</p>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {totals.map((item) => (
            <article key={item.label} className="bg-white p-5 shadow-card">
              <p className="font-display text-3xl font-semibold">{item.value}</p>
              <p className="mt-1 text-sm text-[#1d1a3e]/58">{item.label}</p>
            </article>
          ))}
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`btn-pop px-4 py-2 text-sm ${tab === item ? "bg-[#7357c9] text-white" : "bg-white text-[#1d1a3e]"}`}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "Schools" && (
          <EditorGrid
            left={
              <Panel title="Schools and Classes">
                {(config?.schools ?? []).map((school) => (
                  <PickRow
                    key={school.urn}
                    title={school.name}
                    meta={school.status}
                    body={`URN ${school.urn}`}
                    onClick={() => setSchoolDraft({ ...school })}
                  />
                ))}
                {(config?.classes ?? []).map((classGroup) => (
                  <PickRow
                    key={classGroup.id ?? `${classGroup.school_urn}-${classGroup.name}`}
                    title={classGroup.name}
                    meta={`Year ${classGroup.year_group}`}
                    body={`${classGroup.school_name || classGroup.school_urn} / ${(classGroup.students ?? []).length} learners / ID ${classGroup.id ?? ""}`}
                    onClick={() => {
                      setClassDraft({ ...classGroup });
                      setAssignmentDraft({ ...assignmentDraft, class_id: classGroup.id ?? "" });
                    }}
                  />
                ))}
              </Panel>
            }
            right={
              <div className="grid gap-6">
                <Panel title="School Editor">
                  <Field label="School URN or import key" value={schoolDraft.urn} onChange={(value) => setSchoolDraft({ ...schoolDraft, urn: slug(value) })} />
                  <Field label="School name" value={schoolDraft.name} onChange={(value) => setSchoolDraft({ ...schoolDraft, name: value })} />
                  <Select label="Status" value={schoolDraft.status} values={["trial", "active", "paused", "archived"]} onChange={(status) => setSchoolDraft({ ...schoolDraft, status })} />
                  <Actions disabled={!schoolDraft.urn || !schoolDraft.name || !!saving} onSave={saveSchool} onNew={() => setSchoolDraft({ ...newSchool })} />
                </Panel>
                <Panel title="Class Editor">
                  <Field label="School URN" value={classDraft.school_urn} onChange={(value) => setClassDraft({ ...classDraft, school_urn: slug(value) })} />
                  <Field label="Class name" value={classDraft.name} onChange={(value) => setClassDraft({ ...classDraft, name: value })} />
                  <Field label="Year group" type="number" value={classDraft.year_group} onChange={(value) => setClassDraft({ ...classDraft, year_group: Number(value) })} />
                  <Actions disabled={!classDraft.school_urn || !classDraft.name || !!saving} onSave={saveClassGroup} onNew={() => setClassDraft({ ...newClassGroup })} />
                </Panel>
                <Panel title="Class Assignment">
                  <Field label="Class ID" value={assignmentDraft.class_id} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, class_id: value })} />
                  <Field label="Learner external ref" value={assignmentDraft.student_external_ref} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, student_external_ref: slug(value) })} />
                  <Actions disabled={!assignmentDraft.class_id || !assignmentDraft.student_external_ref || !!saving} onSave={assignStudentToClass} onNew={() => setAssignmentDraft({ class_id: "", student_external_ref: "" })} />
                </Panel>
              </div>
            }
          />
        )}

        {tab === "Learners" && (
          <EditorGrid
            left={
              <Panel title="Learner Profiles">
                {(config?.students ?? []).map((student) => (
                  <PickRow
                    key={student.external_ref}
                    title={student.display_name}
                    meta={`Year ${student.year_group}`}
                    body={student.external_ref}
                    onClick={() => setStudentDraft({ ...student })}
                  />
                ))}
                {(config?.student_credentials ?? []).map((credential) => (
                  <PickRow
                    key={`credential-${credential.student_external_ref}`}
                    title={`${credential.display_name || credential.student_external_ref} access`}
                    meta={credential.login_code ? "login code" : "picture password"}
                    body={`${credential.student_external_ref} / ${(credential.picture_password ?? []).length} picture choices`}
                    onClick={() => setCredentialDraft({ ...credential, picturePasswordText: pretty(credential.picture_password ?? []) })}
                  />
                ))}
              </Panel>
            }
            right={
              <div className="grid gap-6">
                <Panel title="Learner Editor">
                  <Field label="External ref" value={studentDraft.external_ref} onChange={(value) => setStudentDraft({ ...studentDraft, external_ref: slug(value) })} />
                  <Field label="Display name" value={studentDraft.display_name} onChange={(value) => setStudentDraft({ ...studentDraft, display_name: value })} />
                  <Field label="Year group" type="number" value={studentDraft.year_group} onChange={(value) => setStudentDraft({ ...studentDraft, year_group: Number(value) })} />
                  <Actions disabled={!studentDraft.external_ref || !studentDraft.display_name || !!saving} onSave={saveStudent} onNew={() => setStudentDraft({ ...newStudent })} />
                </Panel>
                <Panel title="Pupil Access Editor">
                  <Field label="Learner external ref" value={credentialDraft.student_external_ref} onChange={(value) => setCredentialDraft({ ...credentialDraft, student_external_ref: slug(value) })} />
                  <Field label="Login code" value={credentialDraft.login_code} onChange={(value) => setCredentialDraft({ ...credentialDraft, login_code: value.trim().toUpperCase() })} />
                  <JsonField label="Picture password JSON" value={credentialDraft.picturePasswordText} onChange={(picturePasswordText) => setCredentialDraft({ ...credentialDraft, picturePasswordText })} />
                  <Field label="QR secret hash" value={credentialDraft.qr_secret_hash ?? ""} onChange={(value) => setCredentialDraft({ ...credentialDraft, qr_secret_hash: value })} />
                  <Actions disabled={!credentialDraft.student_external_ref || !!saving} onSave={saveCredential} onNew={() => setCredentialDraft({ ...newCredential, picturePasswordText: pretty(newCredential.picture_password) })} />
                </Panel>
              </div>
            }
          />
        )}

        {tab === "Worlds" && (
          <EditorGrid
            left={
              <Panel title="Configured Worlds">
                {(config?.worlds ?? []).map((world) => (
                  <PickRow
                    key={world.key}
                    title={world.name}
                    meta={`Year ${world.year_group || "all"} / ${world.enabled ? "enabled" : "disabled"}`}
                    body={world.theme}
                    onClick={() => setWorldDraft({ ...world, configText: pretty(world.config ?? {}) })}
                  />
                ))}
              </Panel>
            }
            right={
              <Panel title="World Editor">
                <Field label="Key" value={worldDraft.key} onChange={(value) => setWorldDraft({ ...worldDraft, key: slug(value) })} />
                <Field label="Name" value={worldDraft.name} onChange={(value) => setWorldDraft({ ...worldDraft, name: value })} />
                <Field label="Year group" type="number" value={worldDraft.year_group} onChange={(value) => setWorldDraft({ ...worldDraft, year_group: Number(value) })} />
                <Field label="Theme" value={worldDraft.theme} onChange={(value) => setWorldDraft({ ...worldDraft, theme: value })} />
                <Toggle label="Enabled" checked={worldDraft.enabled} onChange={(enabled) => setWorldDraft({ ...worldDraft, enabled })} />
                <JsonField label="Config JSON" value={worldDraft.configText} onChange={(configText) => setWorldDraft({ ...worldDraft, configText })} />
                <Actions disabled={!worldDraft.key || !worldDraft.name || !!saving} onSave={saveWorld} onNew={() => setWorldDraft({ ...newWorld, configText: pretty(newWorld.config) })} />
              </Panel>
            }
          />
        )}

        {tab === "Activities" && (
          <EditorGrid
            left={
              <Panel title="Configured Activities">
                {(config?.activities ?? []).map((activity) => (
                  <PickRow
                    key={activity.id}
                    title={activity.title || activity.id}
                    meta={activity.status}
                    body={`${activity.world_key} / ${activity.objective_id}`}
                    onClick={() =>
                      setActivityDraft({
                        ...activity,
                        interactionText: pretty(activity.interaction ?? {}),
                        feedbackText: pretty(activity.feedback ?? {}),
                        animationHooksText: pretty(activity.animation_hooks ?? {}),
                      })
                    }
                  />
                ))}
              </Panel>
            }
            right={
              <Panel title="Activity Editor">
                <Field label="ID" value={activityDraft.id} onChange={(value) => setActivityDraft({ ...activityDraft, id: slug(value) })} />
                <Field label="Title" value={activityDraft.title} onChange={(value) => setActivityDraft({ ...activityDraft, title: value })} />
                <Field label="Objective ID" value={activityDraft.objective_id} onChange={(value) => setActivityDraft({ ...activityDraft, objective_id: value })} />
                <Field label="World key" value={activityDraft.world_key} onChange={(value) => setActivityDraft({ ...activityDraft, world_key: value })} />
                <Field label="Template ID" value={activityDraft.template_id} onChange={(value) => setActivityDraft({ ...activityDraft, template_id: value })} />
                <Field label="Prompt" value={activityDraft.prompt} onChange={(value) => setActivityDraft({ ...activityDraft, prompt: value })} />
                <Field label="Difficulty" type="number" value={activityDraft.difficulty} onChange={(value) => setActivityDraft({ ...activityDraft, difficulty: Number(value) })} />
                <Select label="Status" value={activityDraft.status} values={["draft", "review", "approved", "published", "archived"]} onChange={(status) => setActivityDraft({ ...activityDraft, status })} />
                <JsonField label="Interaction JSON" value={activityDraft.interactionText} onChange={(interactionText) => setActivityDraft({ ...activityDraft, interactionText })} />
                <JsonField label="Feedback JSON" value={activityDraft.feedbackText} onChange={(feedbackText) => setActivityDraft({ ...activityDraft, feedbackText })} />
                <JsonField label="Animation Hooks JSON" value={activityDraft.animationHooksText} onChange={(animationHooksText) => setActivityDraft({ ...activityDraft, animationHooksText })} />
                <Actions disabled={!activityDraft.id || !activityDraft.title || !!saving} onSave={saveActivity} onNew={() => setActivityDraft({ ...newActivity, interactionText: pretty(newActivity.interaction), feedbackText: pretty(newActivity.feedback), animationHooksText: pretty(newActivity.animation_hooks) })} />
              </Panel>
            }
          />
        )}

        {tab === "Questions" && (
          <EditorGrid
            left={
              <Panel title="Configured Questions">
                {(config?.questions ?? []).map((question) => (
                  <PickRow
                    key={question.id}
                    title={question.id}
                    meta={question.status}
                    body={`${question.format} / ${question.objective_id}`}
                    onClick={() =>
                      setQuestionDraft({
                        ...question,
                        bodyText: pretty(question.body ?? {}),
                        expectedText: pretty(question.expected_answer ?? {}),
                        hintsText: pretty(question.hints ?? []),
                      })
                    }
                  />
                ))}
              </Panel>
            }
            right={
              <Panel title="Question Editor">
                <Field label="ID" value={questionDraft.id} onChange={(value) => setQuestionDraft({ ...questionDraft, id: slug(value) })} />
                <Field label="Activity ID" value={questionDraft.activity_id} onChange={(value) => setQuestionDraft({ ...questionDraft, activity_id: value })} />
                <Field label="Objective ID" value={questionDraft.objective_id} onChange={(value) => setQuestionDraft({ ...questionDraft, objective_id: value })} />
                <Field label="Format" value={questionDraft.format} onChange={(value) => setQuestionDraft({ ...questionDraft, format: value })} />
                <Field label="Difficulty" type="number" value={questionDraft.difficulty} onChange={(value) => setQuestionDraft({ ...questionDraft, difficulty: Number(value) })} />
                <Select label="Status" value={questionDraft.status} values={["draft", "review", "approved", "published", "archived"]} onChange={(status) => setQuestionDraft({ ...questionDraft, status })} />
                <JsonField label="Body JSON" value={questionDraft.bodyText} onChange={(bodyText) => setQuestionDraft({ ...questionDraft, bodyText })} />
                <JsonField label="Expected Answer JSON" value={questionDraft.expectedText} onChange={(expectedText) => setQuestionDraft({ ...questionDraft, expectedText })} />
                <JsonField label="Hints JSON" value={questionDraft.hintsText} onChange={(hintsText) => setQuestionDraft({ ...questionDraft, hintsText })} />
                <Field label="Explanation" value={questionDraft.explanation} onChange={(value) => setQuestionDraft({ ...questionDraft, explanation: value })} />
                <Actions disabled={!questionDraft.id || !questionDraft.objective_id || !!saving} onSave={saveQuestion} onNew={() => setQuestionDraft({ ...newQuestion, bodyText: pretty(newQuestion.body), expectedText: pretty(newQuestion.expected_answer), hintsText: pretty(newQuestion.hints) })} />
              </Panel>
            }
          />
        )}

        {tab === "Rewards" && (
          <EditorGrid
            left={
              <Panel title="Reward Rules">
                {(config?.reward_rules ?? []).map((rule) => (
                  <PickRow
                    key={rule.id}
                    title={rule.id}
                    meta={`${rule.enabled ? "enabled" : "disabled"} / ${rule.trigger}`}
                    body={`${rule.world_key || "all worlds"} / ${rule.objective_id || "all objectives"}`}
                    onClick={() => setRewardDraft({ ...rule, rewardPayloadText: pretty(rule.reward_payload ?? {}) })}
                  />
                ))}
              </Panel>
            }
            right={
              <Panel title="Reward Editor">
                <Field label="ID" value={rewardDraft.id} onChange={(value) => setRewardDraft({ ...rewardDraft, id: slug(value) })} />
                <Field label="World key" value={rewardDraft.world_key} onChange={(value) => setRewardDraft({ ...rewardDraft, world_key: value })} />
                <Field label="Objective ID" value={rewardDraft.objective_id} onChange={(value) => setRewardDraft({ ...rewardDraft, objective_id: value })} />
                <Select label="Trigger" value={rewardDraft.trigger} values={["attempt.correct", "attempt.incorrect"]} onChange={(trigger) => setRewardDraft({ ...rewardDraft, trigger })} />
                <Toggle label="Enabled" checked={rewardDraft.enabled} onChange={(enabled) => setRewardDraft({ ...rewardDraft, enabled })} />
                <JsonField label="Reward Payload JSON" value={rewardDraft.rewardPayloadText} onChange={(rewardPayloadText) => setRewardDraft({ ...rewardDraft, rewardPayloadText })} />
                <Actions disabled={!rewardDraft.id || !!saving} onSave={saveRewardRule} onNew={() => setRewardDraft({ ...newRewardRule, rewardPayloadText: pretty(newRewardRule.reward_payload) })} />
              </Panel>
            }
          />
        )}

        {tab === "Objectives" && (
          <EditorGrid
            left={
              <Panel title="Curriculum Objectives">
                {objectives.map((objective) => (
                  <PickRow
                    key={objective.id}
                    title={objective.statement}
                    meta={`Y${objective.year} / ${objective.subject}`}
                    body={`${objective.strand} / ${objective.topic}`}
                    onClick={() =>
                      setObjectiveDraft({
                        ...objective,
                        prerequisitesText: pretty(objective.prerequisites ?? []),
                        misconceptionsText: pretty(objective.misconceptions ?? []),
                        retentionDaysText: pretty(objective.mastery?.retention_days ?? []),
                        requiredFormatsText: pretty(objective.mastery?.required_formats ?? []),
                      })
                    }
                  />
                ))}
              </Panel>
            }
            right={
              <Panel title="Objective Editor">
                <Field label="ID" value={objectiveDraft.id} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, id: slug(value) })} />
                <Field label="Year" type="number" value={objectiveDraft.year} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, year: Number(value) })} />
                <Field label="Subject" value={objectiveDraft.subject} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, subject: value })} />
                <Field label="Strand" value={objectiveDraft.strand} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, strand: value })} />
                <Field label="Topic" value={objectiveDraft.topic} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, topic: value })} />
                <Field label="Statement" value={objectiveDraft.statement} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, statement: value })} />
                <Field label="Parent explanation" value={objectiveDraft.parent_explanation} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, parent_explanation: value })} />
                <Field label="Teacher evidence" value={objectiveDraft.teacher_evidence} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, teacher_evidence: value })} />
                <JsonField label="Prerequisites JSON" value={objectiveDraft.prerequisitesText} onChange={(prerequisitesText) => setObjectiveDraft({ ...objectiveDraft, prerequisitesText })} />
                <JsonField label="Misconceptions JSON" value={objectiveDraft.misconceptionsText} onChange={(misconceptionsText) => setObjectiveDraft({ ...objectiveDraft, misconceptionsText })} />
                <Field label="Expected mastery" type="number" value={objectiveDraft.mastery.expected} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, mastery: { ...objectiveDraft.mastery, expected: Number(value) } })} />
                <Field label="Secure mastery" type="number" value={objectiveDraft.mastery.secure} onChange={(value) => setObjectiveDraft({ ...objectiveDraft, mastery: { ...objectiveDraft.mastery, secure: Number(value) } })} />
                <JsonField label="Retention days JSON" value={objectiveDraft.retentionDaysText} onChange={(retentionDaysText) => setObjectiveDraft({ ...objectiveDraft, retentionDaysText })} />
                <JsonField label="Required formats JSON" value={objectiveDraft.requiredFormatsText} onChange={(requiredFormatsText) => setObjectiveDraft({ ...objectiveDraft, requiredFormatsText })} />
                <Actions disabled={!objectiveDraft.id || !objectiveDraft.statement || !!saving} onSave={saveObjective} onNew={() => setObjectiveDraft({ ...newObjective, prerequisitesText: pretty(newObjective.prerequisites), misconceptionsText: pretty(newObjective.misconceptions), retentionDaysText: pretty(newObjective.mastery.retention_days), requiredFormatsText: pretty(newObjective.mastery.required_formats) })} />
              </Panel>
            }
          />
        )}

        {tab === "Flags" && (
          <EditorGrid
            left={
              <Panel title="Feature Flags">
                {(config?.feature_flags ?? []).map((flag) => (
                  <PickRow
                    key={flag.key}
                    title={flag.key}
                    meta={flag.enabled ? "enabled" : "disabled"}
                    body={flag.description}
                    onClick={() => setFlagDraft({ ...flag, configText: pretty(flag.config ?? {}) })}
                  />
                ))}
              </Panel>
            }
            right={
              <Panel title="Flag Editor">
                <Field label="Key" value={flagDraft.key} onChange={(value) => setFlagDraft({ ...flagDraft, key: slug(value) })} />
                <Field label="Description" value={flagDraft.description} onChange={(value) => setFlagDraft({ ...flagDraft, description: value })} />
                <Toggle label="Enabled" checked={flagDraft.enabled} onChange={(enabled) => setFlagDraft({ ...flagDraft, enabled })} />
                <JsonField label="Config JSON" value={flagDraft.configText} onChange={(configText) => setFlagDraft({ ...flagDraft, configText })} />
                <Actions disabled={!flagDraft.key || !!saving} onSave={saveFlag} onNew={() => setFlagDraft({ ...newFlag, configText: pretty(newFlag.config) })} />
              </Panel>
            }
          />
        )}

        {tab === "Audit" && (
          <section className="mt-6 overflow-hidden bg-white shadow-card">
            <div className="border-b border-[#1d1a3e]/8 p-5">
              <h2 className="font-display text-2xl font-semibold">Recent Audit Events</h2>
            </div>
            <div className="divide-y divide-[#1d1a3e]/8">
              {auditLogs.map((log) => (
                <article key={log.id} className="grid gap-2 p-5 md:grid-cols-[160px_1fr_220px]">
                  <p className="font-semibold">{log.action}</p>
                  <p className="text-sm text-[#1d1a3e]/62">{log.entity_type} / {log.entity_id}</p>
                  <p className="text-sm text-[#1d1a3e]/50">{safeDate(log.created_at)}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EditorGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <section className="mt-6 grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">{left}{right}</section>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden bg-white shadow-card">
      <div className="border-b border-[#1d1a3e]/8 p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-[#1d1a3e]/8">{children}</div>
    </section>
  );
}

function PickRow({ title, meta, body, onClick }: { title: string; meta: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="block w-full p-5 text-left transition-colors hover:bg-[#f6f3ea]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <span className="bg-[#55cbd3]/20 px-3 py-1 text-xs font-semibold text-[#155d64]">{meta}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/58">{body}</p>
    </button>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-[#1d1a3e]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]"
      />
    </label>
  );
}

function JsonField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        spellCheck={false}
        className="mt-2 w-full resize-y border border-[#1d1a3e]/14 bg-[#fbfaf6] px-4 py-3 font-mono text-xs leading-5 outline-none focus:border-[#7357c9]"
      />
    </label>
  );
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-[#1d1a3e]/14 bg-white px-4 py-3 text-sm outline-none focus:border-[#7357c9]">
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 p-5">
      <span className="text-sm font-semibold text-[#1d1a3e]/70">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#7357c9]" />
    </label>
  );
}

function Actions({ disabled, onSave, onNew }: { disabled: boolean; onSave: () => void; onNew: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 p-5">
      <button onClick={onNew} className="btn-pop bg-[#f6f3ea] px-5 py-3 text-sm">
        New
      </button>
      <button onClick={onSave} disabled={disabled} className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50">
        Save
      </button>
    </div>
  );
}

function parseJSON<T>(value: string, fallback: string, label: string): T {
  try {
    return JSON.parse(value || fallback) as T;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function requireText(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

function requireRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
}

function requireObject(value: Record<string, unknown>, label: string) {
  if (!value || Object.keys(value).length === 0) throw new Error(`${label} is required.`);
}

function requireStringArray(value: unknown[], label: string, requireItem = false) {
  if (!Array.isArray(value) || (requireItem && value.length === 0) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a JSON array of text values${requireItem ? " with at least one item" : ""}.`);
  }
}

function requireNumberArray(value: unknown[], label: string, requireItem = false) {
  if (!Array.isArray(value) || (requireItem && value.length === 0) || value.some((item) => typeof item !== "number" || item < 1)) {
    throw new Error(`${label} must be a JSON array of positive numbers${requireItem ? " with at least one item" : ""}.`);
  }
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB");
}
