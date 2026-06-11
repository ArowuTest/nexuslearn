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
};

const API = process.env.NEXT_PUBLIC_API_URL;
const EMPTY_OBJECT = "{}";
const EMPTY_ARRAY = "[]";
const TABS = ["Worlds", "Activities", "Questions", "Objectives", "Flags", "Audit"] as const;
type Tab = (typeof TABS)[number];

const newWorld: World = {
  key: "",
  name: "",
  year_group: 4,
  theme: "",
  config: { realm: "", focus: "", accent: "#ffbf45" },
  enabled: true,
};

const newActivity: Activity = {
  id: "",
  objective_id: "",
  template_id: "array-build",
  world_key: "inventor-wilds",
  title: "",
  prompt: "",
  difficulty: 4,
  interaction: { type: "array-build", scaffold: true, review: true, total_questions: 8 },
  feedback: { selection_reason: "", companion_prompt: "" },
  animation_hooks: { primary: "kinetic-array-forge", reward: "world-growth" },
  status: "draft",
};

const newQuestion: Question = {
  id: "",
  activity_id: "",
  objective_id: "",
  format: "multiple_choice",
  body: { prompt: "", choices: [] },
  expected_answer: { value: "" },
  hints: [],
  explanation: "",
  difficulty: 3,
  status: "draft",
};

const newObjective: Objective = {
  id: "",
  year: 4,
  subject: "Mathematics",
  strand: "",
  topic: "",
  statement: "",
  prerequisites: [],
  misconceptions: [],
  mastery: { expected: 80, secure: 90, retention_days: [1, 3, 7, 14, 30], required_formats: [] },
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
      { label: "Activities", value: config?.activities?.length ?? 0 },
      { label: "Questions", value: config?.questions?.length ?? 0 },
      { label: "Objectives", value: objectives.length },
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
    const configBody = parseJSON<Record<string, unknown>>(worldDraft.configText, EMPTY_OBJECT, "world config");
    await save(`/v1/admin/worlds/${worldDraft.key}`, {
      key: worldDraft.key,
      name: worldDraft.name,
      year_group: Number(worldDraft.year_group) || 0,
      theme: worldDraft.theme,
      enabled: worldDraft.enabled,
      config: configBody,
    });
  }

  async function saveActivity() {
    await save(`/v1/admin/content/activities/${activityDraft.id}`, {
      id: activityDraft.id,
      objective_id: activityDraft.objective_id,
      template_id: activityDraft.template_id,
      world_key: activityDraft.world_key,
      title: activityDraft.title,
      prompt: activityDraft.prompt,
      difficulty: Number(activityDraft.difficulty) || 1,
      interaction: parseJSON<Record<string, unknown>>(activityDraft.interactionText, EMPTY_OBJECT, "interaction"),
      feedback: parseJSON<Record<string, unknown>>(activityDraft.feedbackText, EMPTY_OBJECT, "feedback"),
      animation_hooks: parseJSON<Record<string, unknown>>(activityDraft.animationHooksText, EMPTY_OBJECT, "animation hooks"),
      status: activityDraft.status,
    });
  }

  async function saveQuestion() {
    await save(`/v1/admin/content/questions/${questionDraft.id}`, {
      id: questionDraft.id,
      activity_id: questionDraft.activity_id,
      objective_id: questionDraft.objective_id,
      format: questionDraft.format,
      body: parseJSON<Record<string, unknown>>(questionDraft.bodyText, EMPTY_OBJECT, "question body"),
      expected_answer: parseJSON<Record<string, unknown>>(questionDraft.expectedText, EMPTY_OBJECT, "expected answer"),
      hints: parseJSON<string[]>(questionDraft.hintsText, EMPTY_ARRAY, "hints"),
      explanation: questionDraft.explanation,
      difficulty: Number(questionDraft.difficulty) || 1,
      status: questionDraft.status,
    });
  }

  async function saveObjective() {
    await save(`/v1/admin/curriculum/objectives/${objectiveDraft.id}`, {
      id: objectiveDraft.id,
      year: Number(objectiveDraft.year) || 4,
      subject: objectiveDraft.subject,
      strand: objectiveDraft.strand,
      topic: objectiveDraft.topic,
      statement: objectiveDraft.statement,
      prerequisites: parseJSON<string[]>(objectiveDraft.prerequisitesText, EMPTY_ARRAY, "prerequisites"),
      misconceptions: parseJSON<string[]>(objectiveDraft.misconceptionsText, EMPTY_ARRAY, "misconceptions"),
      mastery: {
        expected: Number(objectiveDraft.mastery.expected) || 80,
        secure: Number(objectiveDraft.mastery.secure) || 90,
        retention_days: parseJSON<number[]>(objectiveDraft.retentionDaysText, "[1,3,7,14,30]", "retention days"),
        required_formats: parseJSON<string[]>(objectiveDraft.requiredFormatsText, EMPTY_ARRAY, "required formats"),
      },
      parent_explanation: objectiveDraft.parent_explanation,
      teacher_evidence: objectiveDraft.teacher_evidence,
    });
  }

  async function saveFlag() {
    await save(`/v1/admin/feature-flags/${flagDraft.key}`, {
      key: flagDraft.key,
      enabled: flagDraft.enabled,
      description: flagDraft.description,
      config: parseJSON<Record<string, unknown>>(flagDraft.configText, EMPTY_OBJECT, "feature flag config"),
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
