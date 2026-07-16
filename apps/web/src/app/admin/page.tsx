"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { accountSessionHeaders, logoutAccount, storeAccountSession, type AccountSession } from "@/lib/api";

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
type SchoolUser = {
  id?: string;
  school_urn: string;
  school_name?: string;
  email: string;
  display_name: string;
  role: string;
  login_id: string;
  temporary_password?: string;
  temporary_password_required?: boolean;
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
type LearningGroup = {
  id?: string;
  class_id: string;
  class_name?: string;
  name: string;
  purpose: string;
  students?: StudentProfile[];
  created_at?: string;
  updated_at?: string;
};
type ParentLink = {
  id?: string;
  parent_email: string;
  parent_display_name: string;
  student_external_ref: string;
  student_display_name?: string;
  relationship: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};
type ParentInvitation = {
  id?: string;
  parent_email: string;
  parent_display_name: string;
  student_external_ref: string;
  relationship: string;
  status?: string;
  expires_at?: string;
  token?: string;
};
type AccessRequest = {
  id: string;
  request_type: string;
  organisation_name: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  role: string;
  region: string;
  learner_count: number;
  year_groups: number[];
  support_needs?: string[];
  learning_priorities?: string[];
  message: string;
  status: string;
  source: string;
  created_at?: string;
  updated_at?: string;
};
type AccessRequestConversionResult = {
  access_request: AccessRequest;
  school: School;
  school_user?: SchoolUser;
  class?: ClassGroup;
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
type ContentVersion = {
  id: string;
  content_key: string;
  content_type: string;
  status: string;
  version: number;
  payload?: Record<string, unknown>;
  created_at: string;
  published_at?: string;
};
type ContentReadinessItem = {
  objective_id: string;
  year: number;
  subject: string;
  strand: string;
  topic: string;
  statement: string;
  status: "ready" | "pilot" | "draft" | "blocked";
  score: number;
  activity_count: number;
  published_activity_count: number;
  question_count: number;
  published_question_count: number;
  format_count: number;
  formats: string[];
  missing: string[];
  warnings: string[];
};
type ContentReadinessReport = {
  generated_at: string;
  totals: {
    objectives: number;
    ready: number;
    pilot: number;
    draft: number;
    blocked: number;
    published_activities: number;
    published_questions: number;
    formats: number;
  };
  items: ContentReadinessItem[];
};
type RendererReadinessFormat = {
  format: string;
  pack_count: number;
  questions: number;
  runtime_questions: number;
  runtime_failures: number;
  current_runtime: string;
  target_runtime: string;
};
type RendererReadinessReport = {
  totals: {
    formats: number;
    packs: number;
    questions: number;
    runtime_questions: number;
    runtime_failures: number;
    ready_formats: number;
    preview_only_formats: number;
  };
  formats: RendererReadinessFormat[];
};
type AssetFamily = {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  status: string;
  runtime: boolean;
  years: number[];
  formats: string[];
  variants: string[];
  production_gaps: string[];
};
type AssetReadinessReport = {
  totals: {
    families: number;
    runtime_families: number;
    planned: number;
    prototype: number;
    pilot: number;
    production: number;
    failures: number;
    warnings: number;
  };
  asset_families: AssetFamily[];
};
type NarrationReadinessReport = {
  status: "ready" | "gaps_present";
  totals: {
    expected_assets: number;
    technical_pass: number;
    listening_approved: number;
    missing: number;
    unreviewed: number;
    variant_references: number;
    unresolved_variant_references: number;
    nonconforming_variant_references: number;
  };
  years: Array<{
    year: number;
    expected_assets: number;
    technical_pass: number;
    listening_approved: number;
    missing: number;
    unreviewed: number;
    variant_references: number;
    unresolved_variant_references: number;
  }>;
};
type NarrationListeningPriority = {
  status: string;
  served_by?: string;
  totals: {
    first_pass_assets: number;
    awaiting_listening: number;
    early_years_first_pass: number;
    phonics_or_listening_first_pass: number;
  };
  first_pass: Array<{
    rank: number;
    asset_id: string;
    pack_id: string;
    year: number | null;
    kind: string;
    source_id: string;
    text_preview: string;
    file: string;
    voice_name?: string;
    model_id?: string;
    rationale: string[];
  }>;
};
type PackDepthReadiness = {
  status: string;
  served_by?: string;
  totals: {
    packs: number;
    depth_ready_packs: number;
    needs_attention_packs: number;
    blocked_packs: number;
    authored_variants: number;
    pilot_target: number;
    release_target: number;
    mature_target: number;
    deep_target: number;
    min_pilot_target: number;
    average_depth_score: number;
  };
  years: Array<{
    year: number;
    subject: string;
    packs: number;
    authored_variants: number;
    pilot_target: number;
    mature_target: number;
    deep_target: number;
    min_depth_score: number;
    average_depth_score: number;
  }>;
};
type CurriculumAreaCoverage = {
  totals: {
    contract_areas: number;
    authored_areas: number;
    missing_areas: number;
    breadth_percent: number;
    authored_packs: number;
    proposed_missing_packs: number;
  };
  years: Array<{
    year: number;
    total_areas: number;
    authored_areas: number;
    missing_areas: number;
    breadth_percent: number;
    subjects: Array<{
      subject: string;
      total_areas: number;
      authored_areas: number;
      missing_areas: number;
    }>;
  }>;
};
type ContentReleasePack = {
  pack_id: string;
  channel: string;
  status: string;
  year?: number;
  subject?: string;
  objective_id?: string;
  pack_hash: string;
  payload_hash: string;
  preview_hash: string;
  variant_sample_count: number;
  mature_variant_target: number;
  warnings: string[];
};
type ContentReleaseSnapshot = {
  generated_at: string;
  status: string;
  totals: {
    packs: number;
    authoring: number;
    review: number;
    pilot: number;
    release: number;
    archived: number;
    failures: number;
    warnings: number;
  };
  failures: string[];
  warnings: string[];
  packs: ContentReleasePack[];
};
type VariantProductionItem = {
  rank: number;
  pack_id: string;
  year: number;
  subject: string;
  authored_variants: number;
  runtime_variants: number;
  review_candidates: number;
  pilot_target: number;
  remaining_authoring: number;
  remaining_review: number;
  progress_percent: number;
  blockers: string[];
  next_action: string;
};
type VariantProductionQueue = {
  totals: {
    packs: number;
    pilot_target_variants: number;
    authored_variants: number;
    runtime_variants: number;
    review_candidates: number;
    remaining_review: number;
    blocked_from_pilot?: number;
  };
  next_balanced_batch: string[];
  queue: VariantProductionItem[];
};
type RuntimeSpineEnhancement = {
  status: string;
  policy: {
    minimum_runtime_spine_per_pack: number;
    source_pack_mutation: string;
    deterministic_bank_policy: string;
    rule: string;
  };
  totals: {
    packs: number;
    packs_needing_overlay: number;
    runtime_before: number;
    overlay_variants: number;
    runtime_after_overlay: number;
    packs_below_spine_after_overlay: number;
  };
  rows: Array<{
    pack_id: string;
    year: number;
    subject: string;
    runtime_before: number;
    overlay_variants: number;
    runtime_after_overlay: number;
  }>;
};
type PilotReviewLane = {
  id: string;
  status: "required" | "conditional" | "sample" | string;
  description: string;
};
type PilotReviewPack = {
  pack_id: string;
  year: number;
  subject: string;
  queue_rank: number;
  runtime_variants: number;
  review_candidates: number;
  pilot_target: number;
  recommended_first_pass: number;
  audio_qa_required: boolean;
  renderer_acceptance_required: boolean;
  first_action: string;
  blockers: string[];
  lanes: PilotReviewLane[];
  evidence_required: string[];
  decision_outputs: string[];
};
type PilotReviewBatch = {
  status: string;
  batch_id: string;
  generated_at?: string;
  totals: {
    packs: number;
    review_candidates: number;
    recommended_first_pass: number;
    runtime_variants: number;
    pilot_target: number;
    release_blockers: number;
    audio_qa_required: number;
  };
  decision_policy: {
    promote: string;
    revise: string;
    hold: string;
  };
  operator_guidance: string[];
  packs: PilotReviewPack[];
};
type PilotReviewEvidenceTemplate = {
  status: string;
  source_batch_id: string;
  instructions: string[];
  records: Array<{
    pack_id: string;
    review_state: string;
    decision: string;
    lane_evidence: Array<{
      lane_id: string;
      required_status: string;
      approval: string;
    }>;
  }>;
};
type PilotReviewEvidenceCheck = {
  status: string;
  source_batch_id: string;
  served_by?: string;
  source?: string;
  promotion_allowed: boolean;
  promotion_guard: string;
  totals: {
    records: number;
    batch_packs: number;
    pending_required_lanes: number;
    errors: number;
  };
  warnings: string[];
  errors: string[];
};
type FlagshipReviewReport = {
  totals: {
    packs: number;
    items: number;
    internal_pass: number;
    revise: number;
    release_blocked: number;
    runtime_approved_by_this_review: number;
  };
  packs: Array<{
    pack_id: string;
    authored_items: number;
    internal_pass: number;
    revise: number;
    release_blocked: number;
    runtime_approval_recommendation: string;
  }>;
};

type AdminConfig = {
  feature_flags?: FeatureFlag[];
  worlds?: World[];
  activities?: Activity[];
  questions?: Question[];
  reward_rules?: RewardRule[];
  students?: StudentProfile[];
  schools?: School[];
  school_users?: SchoolUser[];
  classes?: ClassGroup[];
  student_credentials?: StudentCredential[];
  groups?: LearningGroup[];
  parent_links?: ParentLink[];
  access_requests?: AccessRequest[];
};

const API = process.env.NEXT_PUBLIC_API_URL;
const EMPTY_OBJECT = "{}";
const EMPTY_ARRAY = "[]";
const TABS = ["Access", "Schools", "Learners", "Groups", "Parents", "Worlds", "Readiness", "Activities", "Questions", "Rewards", "Objectives", "Flags", "Audit"] as const;
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

const newSchoolUser: SchoolUser = {
  school_urn: "",
  email: "",
  display_name: "",
  role: "school_admin",
  login_id: "",
  status: "active",
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

const newGroup: LearningGroup = {
  class_id: "",
  name: "",
  purpose: "intervention",
  students: [],
};

const newParentLink: ParentLink = {
  parent_email: "",
  parent_display_name: "",
  student_external_ref: "",
  relationship: "parent",
  status: "invited",
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
  const [adminLogin, setAdminLogin] = useState({ login_id: "", password: "" });
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [readiness, setReadiness] = useState<ContentReadinessReport | null>(null);
  const [rendererReadiness, setRendererReadiness] = useState<RendererReadinessReport | null>(null);
  const [assetReadiness, setAssetReadiness] = useState<AssetReadinessReport | null>(null);
  const [narrationReadiness, setNarrationReadiness] = useState<NarrationReadinessReport | null>(null);
  const [narrationListeningPriority, setNarrationListeningPriority] = useState<NarrationListeningPriority | null>(null);
  const [packDepthReadiness, setPackDepthReadiness] = useState<PackDepthReadiness | null>(null);
  const [curriculumCoverage, setCurriculumCoverage] = useState<CurriculumAreaCoverage | null>(null);
  const [releaseSnapshot, setReleaseSnapshot] = useState<ContentReleaseSnapshot | null>(null);
  const [variantQueue, setVariantQueue] = useState<VariantProductionQueue | null>(null);
  const [runtimeSpine, setRuntimeSpine] = useState<RuntimeSpineEnhancement | null>(null);
  const [pilotReviewBatch, setPilotReviewBatch] = useState<PilotReviewBatch | null>(null);
  const [pilotReviewEvidence, setPilotReviewEvidence] = useState<PilotReviewEvidenceTemplate | null>(null);
  const [pilotReviewEvidenceCheck, setPilotReviewEvidenceCheck] = useState<PilotReviewEvidenceCheck | null>(null);
  const [flagshipReview, setFlagshipReview] = useState<FlagshipReviewReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [contentVersions, setContentVersions] = useState<ContentVersion[]>([]);
  const [message, setMessage] = useState("Sign in with a named platform account. The temporary API key remains available only for bootstrap migration.");
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
  const [schoolUserDraft, setSchoolUserDraft] = useState({ ...newSchoolUser });
  const [classDraft, setClassDraft] = useState({ ...newClassGroup });
  const [credentialDraft, setCredentialDraft] = useState({ ...newCredential, picturePasswordText: pretty(newCredential.picture_password) });
  const [assignmentDraft, setAssignmentDraft] = useState({ class_id: "", student_external_ref: "" });
  const [credentialBatchDraft, setCredentialBatchDraft] = useState({ class_id: "", overwrite: false, picturePoolText: pretty(["star", "book", "sun", "tree", "rocket", "moon"]) });
  const [groupDraft, setGroupDraft] = useState({ ...newGroup });
  const [groupAssignmentDraft, setGroupAssignmentDraft] = useState({ group_id: "", student_external_ref: "" });
  const [parentLinkDraft, setParentLinkDraft] = useState({ ...newParentLink });
  const [parentInvitations, setParentInvitations] = useState<ParentInvitation[]>([]);
  const [parentInvitationDraft, setParentInvitationDraft] = useState<ParentInvitation>({
    parent_email: "", parent_display_name: "", student_external_ref: "", relationship: "parent",
  });
  const [latestInvitationURL, setLatestInvitationURL] = useState("");
  const [platformUserDraft, setPlatformUserDraft] = useState({
    email: "", display_name: "", login_id: "", password: "", role: "platform_admin",
  });
  const [accessRequestDraft, setAccessRequestDraft] = useState<AccessRequest | null>(null);
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
      { label: "Content ready", value: readiness?.totals.ready ?? 0 },
    ],
    [config, readiness],
  );

  async function adminFetch(path: string, options: RequestInit = {}) {
    if (!API) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    const headers = new Headers(options.headers);
    const sessionHeaders = accountSessionHeaders(["platform_admin", "content_editor", "content_reviewer"]);
    if (sessionHeaders.Authorization) headers.set("Authorization", sessionHeaders.Authorization);
    else if (adminKey) headers.set("X-Admin-Key", adminKey);
    if (options.body) headers.set("Content-Type", "application/json");
    const res = await fetch(`${API}${path}`, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Admin request failed.");
    return body;
  }

  async function signInAdmin() {
    if (!API) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    setLoading(true);
    setMessage("Signing in...");
    try {
      const res = await fetch(`${API}/v1/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminLogin),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Administrator login failed.");
      storeAccountSession(body.session as AccountSession);
      setAdminLogin({ login_id: adminLogin.login_id, password: "" });
      await loadConfig();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Administrator login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function signOutAdmin() {
    await logoutAccount();
    setConfig(null);
    setObjectives([]);
    setAdminKey("");
    setMessage("Signed out securely.");
  }

  async function loadGeneratedContentReport(name: string) {
    return adminFetch(`/v1/admin/content/reports/${encodeURIComponent(name)}`).catch(() =>
      fetch(`/content/${name}.json`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    );
  }

  async function loadConfig() {
    setLoading(true);
    setMessage("Loading live configuration...");
    try {
      const [loadedConfig, objectiveData, readinessData, auditData, versionsData, invitationData, rendererData, assetData, narrationData, narrationListeningPriorityData, packDepthData, curriculumCoverageData, releaseData, variantQueueData, runtimeSpineData, pilotReviewBatchData, pilotReviewEvidenceData, pilotReviewEvidenceCheckData, flagshipReviewData] = await Promise.all([
        adminFetch("/v1/admin/config"),
        fetch(`${API}/v1/curriculum/objectives`).then((res) => res.json()),
        adminFetch("/v1/admin/content/readiness"),
        adminFetch("/v1/admin/audit"),
        adminFetch("/v1/admin/content/versions"),
        adminFetch("/v1/admin/parent-invitations"),
        loadGeneratedContentReport("interaction-renderer-readiness"),
        loadGeneratedContentReport("asset-production-readiness"),
        loadGeneratedContentReport("narration-readiness"),
        loadGeneratedContentReport("narration-listening-priority"),
        loadGeneratedContentReport("pack-depth-readiness"),
        loadGeneratedContentReport("curriculum-area-coverage"),
        loadGeneratedContentReport("content-release-snapshot"),
        loadGeneratedContentReport("variant-production-queue"),
        loadGeneratedContentReport("runtime-spine-enhancement"),
        loadGeneratedContentReport("pilot-review-batch"),
        loadGeneratedContentReport("pilot-review-evidence-template"),
        loadGeneratedContentReport("pilot-review-evidence-check"),
        loadGeneratedContentReport("flagship-review"),
      ]);
      setConfig(loadedConfig as AdminConfig);
      setObjectives(objectiveData.objectives ?? []);
      setReadiness(readinessData as ContentReadinessReport);
      setRendererReadiness(rendererData as RendererReadinessReport | null);
      setAssetReadiness(assetData as AssetReadinessReport | null);
      setNarrationReadiness(narrationData as NarrationReadinessReport | null);
      setNarrationListeningPriority(narrationListeningPriorityData as NarrationListeningPriority | null);
      setPackDepthReadiness(packDepthData as PackDepthReadiness | null);
      setCurriculumCoverage(curriculumCoverageData as CurriculumAreaCoverage | null);
      setReleaseSnapshot(releaseData as ContentReleaseSnapshot | null);
      setVariantQueue(variantQueueData as VariantProductionQueue | null);
      setRuntimeSpine(runtimeSpineData as RuntimeSpineEnhancement | null);
      setPilotReviewBatch(pilotReviewBatchData as PilotReviewBatch | null);
      setPilotReviewEvidence(pilotReviewEvidenceData as PilotReviewEvidenceTemplate | null);
      setPilotReviewEvidenceCheck(pilotReviewEvidenceCheckData as PilotReviewEvidenceCheck | null);
      setFlagshipReview(flagshipReviewData as FlagshipReviewReport | null);
      setAuditLogs(auditData.audit_logs ?? []);
      setContentVersions(versionsData.content_versions ?? []);
      setParentInvitations(invitationData.parent_invitations ?? []);
      setMessage("Live configuration loaded. Select a row to edit, or create a new item.");
    } catch (error) {
      setConfig(null);
      setReadiness(null);
      setRendererReadiness(null);
      setAssetReadiness(null);
      setNarrationReadiness(null);
      setNarrationListeningPriority(null);
      setPackDepthReadiness(null);
      setCurriculumCoverage(null);
      setReleaseSnapshot(null);
      setVariantQueue(null);
      setRuntimeSpine(null);
      setPilotReviewBatch(null);
      setPilotReviewEvidence(null);
      setPilotReviewEvidenceCheck(null);
      setFlagshipReview(null);
      setAuditLogs([]);
      setContentVersions([]);
      setMessage(error instanceof Error ? error.message : "Could not reach the API.");
    } finally {
      setLoading(false);
    }
  }

  async function savePlatformUser() {
    await save(`/v1/admin/platform-users/${encodeURIComponent(platformUserDraft.email)}`, {
      display_name: platformUserDraft.display_name,
      login_id: platformUserDraft.login_id || platformUserDraft.email,
      password: platformUserDraft.password,
      roles: [platformUserDraft.role],
    });
    setPlatformUserDraft({ email: "", display_name: "", login_id: "", password: "", role: "platform_admin" });
  }

  async function createParentInvitation() {
    setSaving("parent invitation");
    try {
      const result = await adminFetch("/v1/admin/parent-invitations", {
        method: "POST",
        body: JSON.stringify(parentInvitationDraft),
      });
      setLatestInvitationURL(result.accept_url ?? "");
      setParentInvitationDraft({ parent_email: "", parent_display_name: "", student_external_ref: "", relationship: "parent" });
      await loadConfig();
      setMessage("Parent invitation created. Share the one-time URL through an approved channel.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create parent invitation.");
    } finally {
      setSaving("");
    }
  }

  async function updateParentInvitation(id: string, action: "sent" | "resend" | "revoke") {
    setSaving(`parent invitation ${action}`);
    try {
      const result = await adminFetch(`/v1/admin/parent-invitations/${encodeURIComponent(id)}/${action}`, { method: "POST" });
      if (result.parent_invitation?.token) {
        setLatestInvitationURL(`${window.location.origin}/family?invitation=${result.parent_invitation.token}`);
      }
      await loadConfig();
      setMessage(`Parent invitation ${action} completed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update parent invitation.");
    } finally {
      setSaving("");
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

  async function saveSchoolUser() {
    await guardedSave(async () => {
      requireText(schoolUserDraft.school_urn, "School staff school URN");
      requireText(schoolUserDraft.email, "School staff email");
      requireText(schoolUserDraft.display_name, "School staff display name");
      requireText(schoolUserDraft.role, "School staff role");
      const saved = await adminFetch(`/v1/admin/schools/${schoolUserDraft.school_urn}/users/${encodeURIComponent(schoolUserDraft.email)}`, {
        method: "PUT",
        body: JSON.stringify({
          display_name: schoolUserDraft.display_name,
          role: schoolUserDraft.role,
          login_id: schoolUserDraft.login_id,
          status: schoolUserDraft.status,
        }),
      }) as SchoolUser;
      setMessage(`School access created. Login ID: ${saved.login_id}. Temporary password: ${saved.temporary_password ?? "not returned"}`);
      await loadConfig();
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

  async function generateClassCredentials() {
    await guardedSave(async () => {
      const picturePool = parseJSON<string[]>(credentialBatchDraft.picturePoolText, EMPTY_ARRAY, "picture pool");
      requireText(credentialBatchDraft.class_id, "Class ID");
      requireStringArray(picturePool, "Picture pool", true);
      await save(`/v1/admin/classes/${credentialBatchDraft.class_id}/credentials`, {
        overwrite: credentialBatchDraft.overwrite,
        picture_pool: picturePool,
      });
    });
  }

  async function saveGroup() {
    await guardedSave(async () => {
      requireText(groupDraft.class_id, "Group class ID");
      requireText(groupDraft.name, "Group name");
      requireText(groupDraft.purpose, "Group purpose");
      await save(`/v1/admin/groups/${groupDraft.id || slug(`${groupDraft.class_id}-${groupDraft.name}`)}`, {
        class_id: groupDraft.class_id,
        name: groupDraft.name,
        purpose: groupDraft.purpose,
      });
    });
  }

  async function assignStudentToGroup() {
    await guardedSave(async () => {
      requireText(groupAssignmentDraft.group_id, "Group ID");
      requireText(groupAssignmentDraft.student_external_ref, "Learner external ref");
      await save(`/v1/admin/groups/${groupAssignmentDraft.group_id}/students/${groupAssignmentDraft.student_external_ref}`, {});
    });
  }

  async function saveParentLink() {
    await guardedSave(async () => {
      requireText(parentLinkDraft.parent_email, "Parent email");
      requireText(parentLinkDraft.student_external_ref, "Learner external ref");
      requireText(parentLinkDraft.relationship, "Relationship");
      requireText(parentLinkDraft.status, "Status");
      await save(`/v1/admin/parent-links/${parentLinkDraft.student_external_ref}`, {
        parent_email: parentLinkDraft.parent_email,
        parent_display_name: parentLinkDraft.parent_display_name || parentLinkDraft.parent_email,
        relationship: parentLinkDraft.relationship,
        status: parentLinkDraft.status,
      });
    });
  }

  async function updateAccessRequestStatus(status: string) {
    if (!accessRequestDraft?.id) {
      setMessage("Select an access request first.");
      return;
    }
    await guardedSave(async () => {
      await save(`/v1/admin/access-requests/${accessRequestDraft.id}/status`, { status });
      setAccessRequestDraft({ ...accessRequestDraft, status });
    });
  }

  async function convertAccessRequest() {
    if (!accessRequestDraft?.id) {
      setMessage("Select an approved school or tutoring request first.");
      return;
    }
    await guardedSave(async () => {
      const year = accessRequestDraft.year_groups?.[0] ?? 1;
      const organisationName = accessRequestDraft.organisation_name || accessRequestDraft.contact_name;
      const converted = (await adminFetch(`/v1/admin/access-requests/${accessRequestDraft.id}/convert`, {
        method: "POST",
        body: JSON.stringify({
          school_urn: slug(organisationName),
          school_name: organisationName,
          staff_email: accessRequestDraft.contact_email,
          staff_name: accessRequestDraft.contact_name,
          staff_role: "school_admin",
          staff_status: "active",
          class_year_group: year,
          class_name: accessRequestDraft.request_type === "tutor_org" ? `Pilot cohort Y${year}` : `Pilot Y${year}`,
          create_starter_class: true,
        }),
      })) as AccessRequestConversionResult;
      setAccessRequestDraft({ ...converted.access_request });
      setSchoolDraft({ ...converted.school });
      if (converted.school_user?.email) setSchoolUserDraft({ ...converted.school_user });
      if (converted.class?.name) setClassDraft({ ...converted.class });
      const credentialText = converted.school_user?.temporary_password
        ? ` Login ID: ${converted.school_user.login_id}. Temporary password: ${converted.school_user.temporary_password}.`
        : "";
      await loadConfig();
      setMessage(`Request converted into ${converted.school.name}.${credentialText}`);
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

  async function restoreContentVersion(version: ContentVersion) {
    const confirmed = window.confirm(`Restore ${version.content_key} to version ${version.version}? This will create a new audited configuration version.`);
    if (!confirmed) return;
    await guardedSave(async () => {
      setSaving(`restore-${version.id}`);
      setMessage("Restoring content snapshot...");
      await adminFetch(`/v1/admin/content/versions?id=${encodeURIComponent(version.id)}`, { method: "POST" });
      setMessage("Content snapshot restored. Refreshing live configuration...");
      await loadConfig();
    });
    setSaving("");
  }

  async function promoteContentVersion(version: ContentVersion) {
    const target = nextContentStatus(version.status);
    if (!target) return;
    const confirmed = window.confirm(`Promote ${version.content_key} from ${version.status} to ${target}?`);
    if (!confirmed) return;
    await guardedSave(async () => {
      setSaving(`promote-${version.id}`);
      setMessage(`Promoting content to ${target}...`);
      await adminFetch(`/v1/admin/content/versions/${encodeURIComponent(version.id)}/promote`, {
        method: "POST",
        body: JSON.stringify({ status: target }),
      });
      await loadConfig();
      setMessage(`Content promoted to ${target} with an audited immutable snapshot.`);
    });
    setSaving("");
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

        <section className="mt-8 grid gap-4 bg-white p-5 shadow-card md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="text-sm font-semibold">Platform login ID</span>
            <input
              value={adminLogin.login_id}
              onChange={(event) => setAdminLogin({ ...adminLogin, login_id: event.target.value })}
              className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]"
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Password</span>
            <input
              value={adminLogin.password}
              onChange={(event) => setAdminLogin({ ...adminLogin, password: event.target.value })}
              type="password"
              className="mt-2 w-full border border-[#1d1a3e]/15 px-4 py-3 outline-none focus:border-[#7357c9]"
              placeholder="Password"
            />
          </label>
          <button
            onClick={signInAdmin}
            disabled={loading || !adminLogin.login_id || !adminLogin.password}
            className="btn-pop self-end bg-[#ffbf45] px-6 py-3 text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in" : "Sign in"}
          </button>
          <label className="block md:col-span-2">
            <span className="text-xs font-semibold text-[#1d1a3e]/54">Temporary bootstrap API key</span>
            <input value={adminKey} onChange={(event) => setAdminKey(event.target.value)} type="password" className="mt-2 w-full border border-[#1d1a3e]/10 px-4 py-3 outline-none focus:border-[#7357c9]" placeholder="Only needed to create the first named administrator" />
          </label>
          <div className="flex items-end gap-2">
            <button onClick={loadConfig} disabled={loading || !adminKey} className="btn-pop bg-[#55cbd3] px-4 py-3 text-sm disabled:opacity-50">Use bootstrap key</button>
            {config && <button onClick={signOutAdmin} className="btn-pop bg-[#1d1a3e] px-4 py-3 text-sm text-white">Sign out</button>}
          </div>
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

        {tab === "Access" && (
          <EditorGrid
            left={
              <Panel title="Access Requests">
                {(config?.access_requests ?? []).map((request) => (
                  <PickRow
                    key={request.id}
                    title={request.organisation_name || request.contact_name}
                    meta={`${request.request_type} / ${request.status}`}
                    body={`${request.contact_name} / ${request.contact_email} / ${request.learner_count || "unknown"} learners / ${safeDate(request.created_at ?? "")}`}
                    onClick={() => setAccessRequestDraft({ ...request })}
                  />
                ))}
                {(config?.access_requests ?? []).length === 0 && (
                  <div className="p-5 text-sm leading-6 text-[#1d1a3e]/60">
                    Public parent, school and tutoring organisation requests will appear here.
                  </div>
                )}
              </Panel>
            }
            right={
              <div className="grid gap-6">
              <Panel title="Request Review">
                {accessRequestDraft ? (
                  <>
                    <div className="p-5">
                      <p className="font-display text-2xl font-semibold">{accessRequestDraft.organisation_name || accessRequestDraft.contact_name}</p>
                      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/62">
                        {accessRequestDraft.request_type} request from {accessRequestDraft.contact_name} ({accessRequestDraft.contact_email})
                      </p>
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                        <Info label="Status" value={accessRequestDraft.status} />
                        <Info label="Role" value={accessRequestDraft.role || "not provided"} />
                        <Info label="Phone" value={accessRequestDraft.phone || "not provided"} />
                        <Info label="Region" value={accessRequestDraft.region || "not provided"} />
                        <Info label="Learners" value={String(accessRequestDraft.learner_count || "not provided")} />
                        <Info label="Years" value={(accessRequestDraft.year_groups ?? []).map((year) => `Y${year}`).join(", ") || "not provided"} />
                        <Info label="SEND/support" value={(accessRequestDraft.support_needs ?? []).join(", ") || "not provided"} />
                        <Info label="Learning priorities" value={(accessRequestDraft.learning_priorities ?? []).join(", ") || "not provided"} />
                      </div>
                      {accessRequestDraft.message && (
                        <p className="mt-4 rounded-lg bg-[#f6f3ea] p-4 text-sm leading-6 text-[#1d1a3e]/70">{accessRequestDraft.message}</p>
                      )}
                    </div>
                    <div className="grid gap-3 p-5 sm:grid-cols-3">
                      {["reviewing", "approved", "waitlisted", "rejected", "converted"].map((status) => (
                        <button
                          key={status}
                          onClick={() => updateAccessRequestStatus(status)}
                          disabled={!!saving}
                          className={`btn-pop px-4 py-3 text-sm ${accessRequestDraft.status === status ? "bg-[#7357c9] text-white" : "bg-[#f6f3ea] text-[#1d1a3e]"}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-[#1d1a3e]/8 p-5">
                      <button
                        onClick={convertAccessRequest}
                        disabled={!!saving || accessRequestDraft.status !== "approved" || accessRequestDraft.request_type === "parent"}
                        className="btn-pop bg-[#ffbf45] px-5 py-3 text-sm text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Convert to organisation
                      </button>
                      <p className="mt-3 text-xs leading-5 text-[#1d1a3e]/58">
                        Creates a trial organisation, first school-admin login and starter cohort from an approved school or tutoring request.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="p-5 text-sm leading-6 text-[#1d1a3e]/62">
                    Select a request to review contact details, learner volume, year groups and onboarding status.
                  </div>
                )}
              </Panel>
              <Panel title="Named Platform Account">
                <Field label="Email" value={platformUserDraft.email} onChange={(email) => setPlatformUserDraft({ ...platformUserDraft, email: email.trim().toLowerCase() })} />
                <Field label="Display name" value={platformUserDraft.display_name} onChange={(display_name) => setPlatformUserDraft({ ...platformUserDraft, display_name })} />
                <Field label="Login ID" value={platformUserDraft.login_id} onChange={(login_id) => setPlatformUserDraft({ ...platformUserDraft, login_id })} />
                <Field label="Password" type="password" value={platformUserDraft.password} onChange={(password) => setPlatformUserDraft({ ...platformUserDraft, password })} />
                <Select label="Role" value={platformUserDraft.role} values={["platform_admin", "content_reviewer", "content_editor"]} onChange={(role) => setPlatformUserDraft({ ...platformUserDraft, role })} />
                <Actions disabled={!platformUserDraft.email || !platformUserDraft.display_name || platformUserDraft.password.length < 12 || !!saving} onSave={savePlatformUser} onNew={() => setPlatformUserDraft({ email: "", display_name: "", login_id: "", password: "", role: "platform_admin" })} />
              </Panel>
              </div>
            }
          />
        )}

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
                      setCredentialBatchDraft({ ...credentialBatchDraft, class_id: classGroup.id ?? "" });
                    }}
                  />
                ))}
                {(config?.school_users ?? []).map((user) => (
                  <PickRow
                    key={user.id ?? `${user.school_urn}-${user.email}`}
                    title={user.display_name}
                    meta={`${user.role} / ${user.status}`}
                    body={`${user.school_name || user.school_urn} / ${user.email} / login ${user.login_id}`}
                    onClick={() => setSchoolUserDraft({ ...user })}
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
                <Panel title="School Staff Access">
                  <Field label="School URN" value={schoolUserDraft.school_urn} onChange={(value) => setSchoolUserDraft({ ...schoolUserDraft, school_urn: slug(value) })} />
                  <Field label="Email" value={schoolUserDraft.email} onChange={(value) => setSchoolUserDraft({ ...schoolUserDraft, email: value.trim().toLowerCase() })} />
                  <Field label="Display name" value={schoolUserDraft.display_name} onChange={(value) => setSchoolUserDraft({ ...schoolUserDraft, display_name: value })} />
                  <Field label="Login ID" value={schoolUserDraft.login_id} onChange={(value) => setSchoolUserDraft({ ...schoolUserDraft, login_id: slug(value) })} />
                  <Select label="Role" value={schoolUserDraft.role} values={["school_admin", "teacher"]} onChange={(role) => setSchoolUserDraft({ ...schoolUserDraft, role })} />
                  <Select label="Status" value={schoolUserDraft.status} values={["active", "invited", "paused", "archived"]} onChange={(status) => setSchoolUserDraft({ ...schoolUserDraft, status })} />
                  <Actions disabled={!schoolUserDraft.school_urn || !schoolUserDraft.email || !schoolUserDraft.display_name || !!saving} onSave={saveSchoolUser} onNew={() => setSchoolUserDraft({ ...newSchoolUser })} />
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
                <Panel title="Class Login Batch">
                  <Field label="Class ID" value={credentialBatchDraft.class_id} onChange={(value) => setCredentialBatchDraft({ ...credentialBatchDraft, class_id: value })} />
                  <Toggle label="Overwrite existing credentials" checked={credentialBatchDraft.overwrite} onChange={(overwrite) => setCredentialBatchDraft({ ...credentialBatchDraft, overwrite })} />
                  <JsonField label="Picture pool JSON" value={credentialBatchDraft.picturePoolText} onChange={(picturePoolText) => setCredentialBatchDraft({ ...credentialBatchDraft, picturePoolText })} />
                  <Actions disabled={!credentialBatchDraft.class_id || !!saving} onSave={generateClassCredentials} onNew={() => setCredentialBatchDraft({ class_id: "", overwrite: false, picturePoolText: pretty(["star", "book", "sun", "tree", "rocket", "moon"]) })} />
                </Panel>
              </div>
            }
          />
        )}

        {tab === "Groups" && (
          <EditorGrid
            left={
              <Panel title="Teaching Groups">
                {(config?.groups ?? []).map((group) => (
                  <PickRow
                    key={group.id ?? `${group.class_id}-${group.name}`}
                    title={group.name}
                    meta={group.purpose}
                    body={`${group.class_name || group.class_id} / ${(group.students ?? []).length} learners / ID ${group.id ?? ""}`}
                    onClick={() => {
                      setGroupDraft({ ...group });
                      setGroupAssignmentDraft({ ...groupAssignmentDraft, group_id: group.id ?? "" });
                    }}
                  />
                ))}
              </Panel>
            }
            right={
              <div className="grid gap-6">
                <Panel title="Group Editor">
                  <Field label="Class ID" value={groupDraft.class_id} onChange={(value) => setGroupDraft({ ...groupDraft, class_id: value })} />
                  <Field label="Group name" value={groupDraft.name} onChange={(value) => setGroupDraft({ ...groupDraft, name: value })} />
                  <Select label="Purpose" value={groupDraft.purpose} values={["intervention", "challenge", "phonics", "fluency", "senco", "teacher-defined"]} onChange={(purpose) => setGroupDraft({ ...groupDraft, purpose })} />
                  <Actions disabled={!groupDraft.class_id || !groupDraft.name || !!saving} onSave={saveGroup} onNew={() => setGroupDraft({ ...newGroup })} />
                </Panel>
                <Panel title="Group Assignment">
                  <Field label="Group ID" value={groupAssignmentDraft.group_id} onChange={(value) => setGroupAssignmentDraft({ ...groupAssignmentDraft, group_id: value })} />
                  <Field label="Learner external ref" value={groupAssignmentDraft.student_external_ref} onChange={(value) => setGroupAssignmentDraft({ ...groupAssignmentDraft, student_external_ref: slug(value) })} />
                  <Actions disabled={!groupAssignmentDraft.group_id || !groupAssignmentDraft.student_external_ref || !!saving} onSave={assignStudentToGroup} onNew={() => setGroupAssignmentDraft({ group_id: "", student_external_ref: "" })} />
                </Panel>
              </div>
            }
          />
        )}

        {tab === "Parents" && (
          <EditorGrid
            left={
              <div className="grid gap-6">
                <Panel title="Parent Links">
                  {(config?.parent_links ?? []).map((link) => (
                    <PickRow
                      key={link.id ?? `${link.parent_email}-${link.student_external_ref}`}
                      title={link.parent_display_name || link.parent_email}
                      meta={link.status}
                      body={`${link.parent_email} / ${link.student_display_name || link.student_external_ref} / ${link.relationship}`}
                      onClick={() => setParentLinkDraft({ ...link })}
                    />
                  ))}
                </Panel>
                <Panel title="Invitation History">
                  {parentInvitations.map((invitation) => (
                    <div key={invitation.id} className="border-b border-[#1d1a3e]/8 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{invitation.parent_display_name || invitation.parent_email}</p>
                          <p className="mt-1 text-xs text-[#1d1a3e]/58">{invitation.student_external_ref} / {invitation.relationship}</p>
                        </div>
                        <span className="rounded-lg bg-[#f6f3ea] px-3 py-1 text-xs font-semibold">{invitation.status}</span>
                      </div>
                      {invitation.id && invitation.status !== "accepted" && invitation.status !== "revoked" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => updateParentInvitation(invitation.id!, "sent")} className="rounded-lg bg-[#55cbd3] px-3 py-2 text-xs font-semibold">Mark sent</button>
                          <button onClick={() => updateParentInvitation(invitation.id!, "resend")} className="rounded-lg bg-[#ffbf45] px-3 py-2 text-xs font-semibold">Rotate and resend</button>
                          <button onClick={() => updateParentInvitation(invitation.id!, "revoke")} className="rounded-lg bg-[#1d1a3e] px-3 py-2 text-xs font-semibold text-white">Revoke</button>
                        </div>
                      )}
                    </div>
                  ))}
                </Panel>
              </div>
            }
            right={
              <div className="grid gap-6">
                <Panel title="Create Parent Invitation">
                  <Field label="Parent email" value={parentInvitationDraft.parent_email} onChange={(value) => setParentInvitationDraft({ ...parentInvitationDraft, parent_email: value.trim().toLowerCase() })} />
                  <Field label="Parent name" value={parentInvitationDraft.parent_display_name} onChange={(value) => setParentInvitationDraft({ ...parentInvitationDraft, parent_display_name: value })} />
                  <Field label="Learner external ref" value={parentInvitationDraft.student_external_ref} onChange={(value) => setParentInvitationDraft({ ...parentInvitationDraft, student_external_ref: slug(value) })} />
                  <Select label="Relationship" value={parentInvitationDraft.relationship} values={["parent", "guardian", "carer"]} onChange={(relationship) => setParentInvitationDraft({ ...parentInvitationDraft, relationship })} />
                  <Actions disabled={!parentInvitationDraft.parent_email || !parentInvitationDraft.student_external_ref || !!saving} onSave={createParentInvitation} onNew={() => setParentInvitationDraft({ parent_email: "", parent_display_name: "", student_external_ref: "", relationship: "parent" })} />
                  {latestInvitationURL && <p className="break-all border-t border-[#1d1a3e]/8 p-5 text-xs leading-5 text-[#1d1a3e]/64">{latestInvitationURL}</p>}
                </Panel>
                <Panel title="Direct Parent Link Editor">
                  <Field label="Parent email" value={parentLinkDraft.parent_email} onChange={(value) => setParentLinkDraft({ ...parentLinkDraft, parent_email: value.trim().toLowerCase() })} />
                  <Field label="Parent display name" value={parentLinkDraft.parent_display_name} onChange={(value) => setParentLinkDraft({ ...parentLinkDraft, parent_display_name: value })} />
                  <Field label="Learner external ref" value={parentLinkDraft.student_external_ref} onChange={(value) => setParentLinkDraft({ ...parentLinkDraft, student_external_ref: slug(value) })} />
                  <Select label="Relationship" value={parentLinkDraft.relationship} values={["parent", "guardian", "carer"]} onChange={(relationship) => setParentLinkDraft({ ...parentLinkDraft, relationship })} />
                  <Select label="Status" value={parentLinkDraft.status} values={["invited", "active", "paused", "revoked"]} onChange={(status) => setParentLinkDraft({ ...parentLinkDraft, status })} />
                  <Actions disabled={!parentLinkDraft.parent_email || !parentLinkDraft.student_external_ref || !!saving} onSave={saveParentLink} onNew={() => setParentLinkDraft({ ...newParentLink })} />
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

        {tab === "Readiness" && (
          <section className="mt-6 grid gap-6">
            <section className="grid gap-4 md:grid-cols-4">
              {[
                { label: "Ready", value: readiness?.totals.ready ?? 0, tone: "ready" },
                { label: "Pilot", value: readiness?.totals.pilot ?? 0, tone: "pilot" },
                { label: "Draft", value: readiness?.totals.draft ?? 0, tone: "draft" },
                { label: "Blocked", value: readiness?.totals.blocked ?? 0, tone: "blocked" },
              ].map((item) => (
                <article key={item.label} className="bg-white p-5 shadow-card">
                  <p className="font-display text-3xl font-semibold">{item.value}</p>
                  <p className={`mt-2 inline-flex px-3 py-1 text-xs font-semibold ${readinessBadgeClass(item.tone)}`}>{item.label}</p>
                </article>
              ))}
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">Pack Depth & Gamification</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                      This separates pilot seed volume from mature/deep curriculum depth. A 180-item pack is acceptable only as a governed pilot seed; mature and deep targets remain visible before scale.
                    </p>
                  </div>
                  <a
                    href="/content/pack-depth-readiness.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full bg-[#155d64] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open depth report
                  </a>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#1d1a3e]/58">
                  Report source: {packDepthReadiness?.served_by === "api" ? "backend API" : "static fallback"}. Floors cover teaching stages, manipulatives, practice formats, variant blueprints, authored variants, animation states and SEND/equivalent-response policy.
                </p>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4 xl:grid-cols-6">
                <Info label="Depth-ready packs" value={`${packDepthReadiness?.totals.depth_ready_packs ?? 0}/${packDepthReadiness?.totals.packs ?? 0}`} />
                <Info label="Blocked packs" value={String(packDepthReadiness?.totals.blocked_packs ?? 0)} />
                <Info label="Authored variants" value={String(packDepthReadiness?.totals.authored_variants ?? 0)} />
                <Info label="Pilot target" value={String(packDepthReadiness?.totals.pilot_target ?? 0)} />
                <Info label="Mature target" value={String(packDepthReadiness?.totals.mature_target ?? 0)} />
                <Info label="Deep target" value={String(packDepthReadiness?.totals.deep_target ?? 0)} />
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-3">
                {(packDepthReadiness?.years ?? []).slice(0, 21).map((row) => (
                  <article key={`${row.year}-${row.subject}`} className="rounded-2xl border border-[#1d1a3e]/8 bg-[#f8fbff] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Year {row.year} {row.subject}</p>
                      <span className="rounded-full bg-[#55cbd3]/12 px-3 py-1 text-xs font-semibold text-[#155d64]">
                        score {row.average_depth_score}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/62">
                      {row.packs} packs · {row.authored_variants} authored · pilot {row.pilot_target} · mature {row.mature_target} · deep {row.deep_target}
                    </p>
                  </article>
                ))}
                {!packDepthReadiness && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Pack depth readiness will appear after the generated content report is available.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">Narration Production Readiness</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                      Authored scripts, produced ElevenLabs files, technical validation and human listening approval are separate gates. Question-level audio references remain unresolved until a matching produced asset is registered.
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold ${narrationReadiness?.status === "ready" ? "bg-[#dff7e7] text-[#28613c]" : "bg-[#fff4d5] text-[#725100]"}`}>
                    {narrationReadiness?.status === "ready" ? "release ready" : "production gaps"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="/content/narration-readiness.html" target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#8b2b2b] px-4 py-2 text-sm font-semibold text-white">
                    Open full narration audit
                  </a>
                  <a href="/content/listening-qa.html" target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#17233f] px-4 py-2 text-sm font-semibold text-white">
                    Open listening QA
                  </a>
                  <a href="/content/narration-listening-priority.html" target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#155d64] px-4 py-2 text-sm font-semibold text-white">
                    Open priority queue
                  </a>
                </div>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4 lg:grid-cols-7">
                <Info label="Scripts" value={String(narrationReadiness?.totals.expected_assets ?? 0)} />
                <Info label="Technical pass" value={String(narrationReadiness?.totals.technical_pass ?? 0)} />
                <Info label="Missing MP3s" value={String(narrationReadiness?.totals.missing ?? 0)} />
                <Info label="Listening approved" value={String(narrationReadiness?.totals.listening_approved ?? 0)} />
                <Info label="Awaiting listening" value={String(narrationReadiness?.totals.unreviewed ?? 0)} />
                <Info label="Variant audio refs" value={String(narrationReadiness?.totals.variant_references ?? 0)} />
                <Info label="Unresolved refs" value={String(narrationReadiness?.totals.unresolved_variant_references ?? 0)} />
              </div>
              {narrationReadiness && (
                <div className="border-b border-[#1d1a3e]/8 bg-[#fff8e8] p-5">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <article className="rounded-2xl border border-[#f0b35a]/35 bg-white p-4">
                      <p className="font-display text-sm font-semibold text-[#725100]">Release interpretation</p>
                      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/68">
                        {narrationReadiness.totals.technical_pass}/{narrationReadiness.totals.expected_assets} files are technically valid, but {narrationReadiness.totals.unreviewed} still need human listening approval before they can be treated as production narration.
                      </p>
                    </article>
                    <article className="rounded-2xl border border-[#f0b35a]/35 bg-white p-4">
                      <p className="font-display text-sm font-semibold text-[#725100]">Child runtime policy</p>
                      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/68">
                        Browser text-to-speech remains prohibited for narration and phonics. If an approved produced asset is unavailable, the runtime must show an honest preparation state with text, visual, partner-reading or AAC routes.
                      </p>
                    </article>
                    <article className="rounded-2xl border border-[#f0b35a]/35 bg-white p-4">
                      <p className="font-display text-sm font-semibold text-[#725100]">Next production action</p>
                      <p className="mt-2 text-sm leading-6 text-[#1d1a3e]/68">
                        Start listening QA with Year 1-2 phonics, listening and early-number assets first, then progress through SEND-heavy and audio-first packs before marking any pack audio-approved.
                      </p>
                    </article>
                  </div>
                </div>
              )}
              {narrationListeningPriority && (
                <div className="border-b border-[#1d1a3e]/8 bg-[#f8fbff] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xs uppercase tracking-[0.14em] text-[#155d64]">Listening QA first pass</p>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/68">
                        Backend report source: {narrationListeningPriority.served_by === "api" ? "backend API" : "static fallback"}. Review the ranked assets before approving any Year 1-2, phonics or audio-first mission narration.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#fff4d5] px-3 py-1 text-xs font-semibold text-[#725100]">
                      {narrationListeningPriority.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                    <Info label="First-pass assets" value={String(narrationListeningPriority.totals.first_pass_assets)} />
                    <Info label="Awaiting listening" value={String(narrationListeningPriority.totals.awaiting_listening)} />
                    <Info label="Year 1-2 assets" value={String(narrationListeningPriority.totals.early_years_first_pass)} />
                    <Info label="Phonics/listening" value={String(narrationListeningPriority.totals.phonics_or_listening_first_pass)} />
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {narrationListeningPriority.first_pass.slice(0, 4).map((item) => (
                      <article key={item.asset_id} className="rounded-2xl border border-[#1d1a3e]/8 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold">{item.asset_id}</p>
                          <span className="rounded-full bg-[#55cbd3]/12 px-3 py-1 text-xs font-semibold text-[#155d64]">#{item.rank}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/62">
                          Y{item.year ?? "?"} - {item.kind} - {item.pack_id}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/68">
                          {item.rationale.slice(0, 2).join("; ")}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
                {(narrationReadiness?.years ?? []).map((year) => (
                  <article key={year.year} className="border border-[#1d1a3e]/8 bg-[#fffdf7] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-lg font-semibold">Year {year.year}</p>
                      <span className="bg-[#fff4d5] px-3 py-1 text-xs font-semibold text-[#725100]">{year.missing} missing</span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#1d1a3e]/62">
                      {year.technical_pass}/{year.expected_assets} technical · {year.listening_approved} listening approved · {year.unresolved_variant_references}/{year.variant_references} variant references unresolved.
                    </p>
                  </article>
                ))}
                {!narrationReadiness && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Narration readiness will appear after the generated audio report is available.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Core Curriculum Breadth</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  This is the honest breadth measure for the declared Year 1–7 English, mathematics and science contract. It does not treat one proof pack per year as complete curriculum coverage.
                </p>
                <a
                  href="/content/curriculum-area-coverage.html"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-[#8b2b2b] px-4 py-2 text-sm font-semibold text-white"
                >
                  Open full missing-area matrix
                </a>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4">
                <Info label="Contract areas" value={String(curriculumCoverage?.totals.contract_areas ?? 0)} />
                <Info label="Areas with a pack" value={String(curriculumCoverage?.totals.authored_areas ?? 0)} />
                <Info label="Missing areas" value={String(curriculumCoverage?.totals.missing_areas ?? 0)} />
                <Info label="Breadth" value={`${curriculumCoverage?.totals.breadth_percent ?? 0}%`} />
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {(curriculumCoverage?.years ?? []).map((year) => (
                  <article key={year.year} className="border border-[#1d1a3e]/8 bg-[#fffdf7] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-lg font-semibold">Year {year.year}</p>
                      <span className="rounded-full bg-[#fff0ec] px-3 py-1 text-xs font-semibold text-[#8b2b2b]">
                        {year.authored_areas}/{year.total_areas} areas
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {year.subjects.map((subject) => (
                        <div key={subject.subject} className="rounded-xl bg-white p-3 text-xs">
                          <p className="font-semibold">{subject.subject}</p>
                          <p className="mt-1 text-[#1d1a3e]/65">
                            {subject.authored_areas}/{subject.total_areas} covered · {subject.missing_areas} missing
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Renderer Readiness Gate</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  Approved child-runtime questions must have a real renderer, scoring path and accessible interaction contract. Ambitious future formats can stay authored in review without leaking into live missions.
                </p>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4">
                <Info label="Registered formats" value={String(rendererReadiness?.totals.formats ?? 0)} />
                <Info label="Runtime questions checked" value={String(rendererReadiness?.totals.runtime_questions ?? 0)} />
                <Info label="Ready formats" value={String(rendererReadiness?.totals.ready_formats ?? 0)} />
                <Info label="Gate failures" value={String(rendererReadiness?.totals.runtime_failures ?? 0)} />
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {(rendererReadiness?.formats ?? [])
                  .filter((format) => format.runtime_questions > 0 || format.runtime_failures > 0)
                  .slice(0, 12)
                  .map((format) => (
                    <article key={format.format} className="border border-[#1d1a3e]/8 bg-[#f8fbff] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{format.format}</p>
                        <span className={`px-3 py-1 text-xs font-semibold ${rendererBadgeClass(format)}`}>
                          {format.runtime_failures ? "blocked" : format.current_runtime}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/58">
                        {format.runtime_questions} runtime questions across {format.pack_count} packs. Target: {format.target_runtime || "not set"}.
                      </p>
                    </article>
                  ))}
                {!rendererReadiness && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Renderer readiness will appear after the generated content report is available in the web build.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Asset Production Readiness</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  Produced companions, world art, manipulatives and narration need accessibility, year coverage and release status before they become part of the scaled child experience.
                </p>
                <a
                  href="/content/listening-qa.html"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full bg-[#17233f] px-4 py-2 text-sm font-semibold text-white"
                >
                  Open narration listening QA
                </a>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4">
                <Info label="Asset families" value={String(assetReadiness?.totals.families ?? 0)} />
                <Info label="Runtime families" value={String(assetReadiness?.totals.runtime_families ?? 0)} />
                <Info label="Prototype" value={String(assetReadiness?.totals.prototype ?? 0)} />
                <Info label="Gate failures" value={String(assetReadiness?.totals.failures ?? 0)} />
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {(assetReadiness?.asset_families ?? []).map((family) => (
                  <article key={family.id} className="border border-[#1d1a3e]/8 bg-[#fffdf7] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{family.name}</p>
                      <span className={`px-3 py-1 text-xs font-semibold ${assetBadgeClass(family.status)}`}>{family.status}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/58">{family.purpose}</p>
                    <p className="mt-2 text-xs font-semibold text-[#1d1a3e]/64">
                      Years {family.years.join(", ")} / {family.runtime ? "runtime" : "production backlog"} / {family.formats.join(", ")}
                    </p>
                    {family.production_gaps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {family.production_gaps.map((gap) => (
                          <span key={gap} className="bg-[#fff4d5] px-3 py-1 text-xs font-semibold text-[#725100]">{gap}</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {!assetReadiness && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Asset readiness will appear after the generated asset report is available in the web build.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Flagship Review Decisions</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  Internal product and technical review is recorded separately from independent teacher, produced-audio, accessibility, safeguarding and child-pilot approval.
                </p>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4">
                <Info label="Items reviewed" value={String(flagshipReview?.totals.items ?? 0)} />
                <Info label="Internal pass" value={String(flagshipReview?.totals.internal_pass ?? 0)} />
                <Info label="Release blocked" value={String(flagshipReview?.totals.release_blocked ?? 0)} />
                <Info label="Runtime approved" value={String(flagshipReview?.totals.runtime_approved_by_this_review ?? 0)} />
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-3">
                {(flagshipReview?.packs ?? []).map((pack) => (
                  <article key={pack.pack_id} className="border border-[#1d1a3e]/8 bg-[#fff8f8] p-4">
                    <p className="font-semibold">{pack.pack_id}</p>
                    <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/58">
                      {pack.authored_items} reviewed · {pack.internal_pass} internal pass · {pack.release_blocked} release-blocked.
                    </p>
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#8b2b2b]">{pack.runtime_approval_recommendation}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Reviewed Variant Production Queue</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  This queue measures the real gap to pilot depth. Runtime-spine overlays keep every pack playable, but source candidates still require curriculum, teacher, SEND/accessibility, safeguarding, renderer and pilot evidence before production promotion.
                </p>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-6">
                <Info label="Authored variants" value={String(variantQueue?.totals.authored_variants ?? 0)} />
                <Info label="Source runtime approved" value={String(variantQueue?.totals.runtime_variants ?? 0)} />
                <Info label="Runtime spine overlays" value={String(runtimeSpine?.totals.overlay_variants ?? 0)} />
                <Info label="Playable runtime path" value={String(runtimeSpine?.totals.runtime_after_overlay ?? variantQueue?.totals.runtime_variants ?? 0)} />
                <Info label="Awaiting review" value={String(variantQueue?.totals.review_candidates ?? 0)} />
                <Info label="Blocked from pilot" value={String(variantQueue?.totals.blocked_from_pilot ?? 0)} />
              </div>
              {variantQueue && (
                <div className="border-b border-[#1d1a3e]/8 bg-[#f7fbff] p-5">
                  <p className="max-w-4xl text-sm leading-6 text-[#1d1a3e]/68">
                    Production interpretation: {variantQueue.totals.authored_variants} source variants are authored; {variantQueue.totals.runtime_variants} are source-approved for runtime and {runtimeSpine?.totals.overlay_variants ?? 0} deterministic starter overlays provide a safe child runtime path. The overlays are not a substitute for production approval: {variantQueue.totals.review_candidates} candidates still need curriculum accuracy, independent teacher review, SEND/accessibility review, safeguarding review, renderer acceptance and pilot calibration evidence.
                  </p>
                  {runtimeSpine && (
                    <div className="mt-4 grid gap-3 rounded-3xl border border-[#55cbd3]/25 bg-white p-4 text-xs leading-5 text-[#1d1a3e]/68 md:grid-cols-3">
                      <div>
                        <p className="font-display uppercase tracking-[0.14em] text-[#155d64]">Runtime spine policy</p>
                        <p className="mt-2">{runtimeSpine.policy.source_pack_mutation === "prohibited" ? "Source packs are not mutated." : runtimeSpine.policy.source_pack_mutation}</p>
                      </div>
                      <div>
                        <p className="font-display uppercase tracking-[0.14em] text-[#155d64]">Overlay coverage</p>
                        <p className="mt-2">{runtimeSpine.totals.packs_needing_overlay}/{runtimeSpine.totals.packs} packs use overlays; {runtimeSpine.totals.packs_below_spine_after_overlay} remain below the 3-item live-path minimum.</p>
                      </div>
                      <div>
                        <p className="font-display uppercase tracking-[0.14em] text-[#155d64]">Product rule</p>
                        <p className="mt-2">Use overlays for safe starter play; promote source variants only after evidence review.</p>
                      </div>
                    </div>
                  )}
                  {variantQueue.next_balanced_batch.length > 0 && (
                    <div className="mt-4">
                      <p className="font-display text-xs uppercase tracking-[0.14em] text-[#155d64]">Next balanced review batch</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {variantQueue.next_balanced_batch.map((packID) => (
                          <span key={packID} className="rounded-full bg-[#55cbd3]/18 px-3 py-1 text-xs font-semibold text-[#155d64]">{packID}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {(variantQueue?.queue ?? []).slice(0, 10).map((item) => (
                  <article key={item.pack_id} className="border border-[#1d1a3e]/8 bg-[#fffdf7] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{item.pack_id}</p>
                      <span className="bg-[#7357c9]/12 px-3 py-1 text-xs font-semibold text-[#4d3690]">#{item.rank}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/58">
                      Y{item.year} {item.subject} · {item.runtime_variants}/{item.pilot_target} reviewed runtime items · {item.review_candidates} awaiting review.
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1d1a3e]/8">
                      <div className="h-full rounded-full bg-[#55cbd3]" style={{ width: `${Math.max(2, item.progress_percent)}%` }} />
                    </div>
                    {item.blockers?.length > 0 && (
                      <div className="mt-3 rounded-2xl border border-[#f0b35a]/35 bg-[#fff6df] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a4d00]">Promotion blockers</p>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-[#1d1a3e]/68">
                          {item.blockers.slice(0, 4).map((blocker) => (
                            <li key={blocker}>- {blocker}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#155d64]">{item.next_action}</p>
                  </article>
                ))}
                {!variantQueue && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Variant production priorities will appear after the generated depth report is available.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">Pilot Review Batch Control</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                      This board converts the balanced production queue into a governed first-pass review workflow. It keeps curriculum depth, SEND, safeguarding, renderer acceptance and ElevenLabs listening QA explicit before runtime promotion.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href="/content/pilot-review-evidence-template.html" target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#17233f] px-4 py-2 text-sm font-semibold text-white">
                      Open evidence template
                    </a>
                    <span className="bg-[#fff4d5] px-3 py-2 text-xs font-semibold text-[#725100]">
                      {pilotReviewBatch?.status?.replaceAll("_", " ") ?? "batch pending"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-6">
                <Info label="Batch packs" value={String(pilotReviewBatch?.totals.packs ?? 0)} />
                <Info label="First-pass items" value={String(pilotReviewBatch?.totals.recommended_first_pass ?? 0)} />
                <Info label="Review candidates" value={String(pilotReviewBatch?.totals.review_candidates ?? 0)} />
                <Info label="Runtime / pilot" value={`${pilotReviewBatch?.totals.runtime_variants ?? 0}/${pilotReviewBatch?.totals.pilot_target ?? 0}`} />
                <Info label="Release blockers" value={String(pilotReviewBatch?.totals.release_blockers ?? 0)} />
                <Info label="Audio QA packs" value={String(pilotReviewBatch?.totals.audio_qa_required ?? 0)} />
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 bg-[#f8fbff] p-5 text-sm md:grid-cols-5">
                <Info label="Evidence records" value={String(pilotReviewEvidence?.records.length ?? 0)} />
                <Info label="Pending records" value={String((pilotReviewEvidence?.records ?? []).filter((record) => record.review_state !== "approved").length)} />
                <Info label="Required lanes pending" value={String(pilotReviewEvidenceCheck?.totals.pending_required_lanes ?? 0)} />
                <Info label="Gate errors" value={String(pilotReviewEvidenceCheck?.totals.errors ?? 0)} />
                <Info label="Gate source" value={pilotReviewEvidenceCheck?.served_by === "api" ? "backend API" : "static fallback"} />
              </div>
              <div className={`border-b border-[#1d1a3e]/8 p-5 text-sm ${pilotReviewEvidenceCheck?.promotion_allowed ? "bg-[#effaf3] text-[#155d36]" : "bg-[#fff4d5] text-[#725100]"}`}>
                <p className="font-semibold">
                  Evidence gate: {pilotReviewEvidenceCheck?.status?.replaceAll("_", " ") ?? "pending backend report"}
                </p>
                <p className="mt-1 leading-6">
                  {pilotReviewEvidenceCheck?.promotion_guard ?? "The backend evidence-check report will appear after content quality runs."}
                </p>
              </div>
              {pilotReviewBatch && (
                <div className="border-b border-[#1d1a3e]/8 bg-[#fbfaf6] p-5">
                  <p className="font-display text-xs uppercase tracking-[0.14em] text-[#155d64]">Decision policy</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {Object.entries(pilotReviewBatch.decision_policy).map(([decision, policy]) => (
                      <article key={decision} className="border border-[#1d1a3e]/8 bg-white p-4">
                        <p className="font-semibold capitalize">{decision}</p>
                        <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/62">{policy}</p>
                      </article>
                    ))}
                  </div>
                  <ul className="mt-4 grid gap-2 text-xs leading-5 text-[#1d1a3e]/68 md:grid-cols-2">
                    {pilotReviewBatch.operator_guidance.map((guidance) => (
                      <li key={guidance} className="rounded-2xl bg-[#55cbd3]/10 px-3 py-2">- {guidance}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {(pilotReviewBatch?.packs ?? []).map((pack) => (
                  <article key={pack.pack_id} className="border border-[#1d1a3e]/8 bg-[#fffdf7] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{pack.pack_id}</p>
                        <p className="mt-1 text-xs leading-5 text-[#1d1a3e]/58">
                          Y{pack.year} {pack.subject} Â· queue #{pack.queue_rank} Â· first pass {pack.recommended_first_pass}/{pack.review_candidates}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pack.audio_qa_required && <span className="bg-[#fff4d5] px-3 py-1 text-xs font-semibold text-[#725100]">audio QA</span>}
                        {pack.renderer_acceptance_required && <span className="bg-[#fde4e4] px-3 py-1 text-xs font-semibold text-[#8b2b2b]">renderer gate</span>}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {pack.lanes.map((lane) => (
                        <div key={lane.id} className="rounded-2xl border border-[#1d1a3e]/8 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{lane.id.replaceAll("_", " ")}</p>
                            <span className={`px-2 py-0.5 text-[11px] font-semibold ${pilotLaneBadgeClass(lane.status)}`}>{lane.status}</span>
                          </div>
                          <p className="mt-2 text-[11px] leading-4 text-[#1d1a3e]/58">{lane.description}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-[#155d64]">{pack.first_action}</p>
                    {pack.blockers.length > 0 && (
                      <ul className="mt-3 space-y-1 rounded-2xl border border-[#f0b35a]/35 bg-[#fff6df] p-3 text-xs leading-5 text-[#1d1a3e]/68">
                        {pack.blockers.slice(0, 4).map((blocker) => (
                          <li key={blocker}>- {blocker}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
                {!pilotReviewBatch && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Pilot batch controls will appear after the generated batch report is available.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Content Release Control</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  Objective packs stay in controlled release channels until their payloads, previews, accessibility checks, item-bank depth and pilot evidence are ready.
                </p>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4">
                <Info label="Tracked packs" value={String(releaseSnapshot?.totals.packs ?? 0)} />
                <Info label="Authoring" value={String(releaseSnapshot?.totals.authoring ?? 0)} />
                <Info label="Release failures" value={String(releaseSnapshot?.totals.failures ?? 0)} />
                <Info label="Warnings" value={String(releaseSnapshot?.totals.warnings ?? 0)} />
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {(releaseSnapshot?.packs ?? []).slice(0, 12).map((pack) => (
                  <article key={pack.pack_id} className="border border-[#1d1a3e]/8 bg-[#f8fbff] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{pack.pack_id}</p>
                      <span className={`px-3 py-1 text-xs font-semibold ${releaseBadgeClass(pack.channel)}`}>{pack.channel}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#1d1a3e]/58">
                      Y{pack.year ?? "-"} / {pack.subject ?? "subject"} / {pack.variant_sample_count}/{pack.mature_variant_target} variants.
                    </p>
                    <p className="mt-2 break-all font-mono text-[11px] text-[#1d1a3e]/45">
                      pack {pack.pack_hash.slice(0, 12)} / payload {pack.payload_hash.slice(0, 12)} / preview {pack.preview_hash.slice(0, 12)}
                    </p>
                    {pack.warnings.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pack.warnings.slice(0, 3).map((warning) => (
                          <span key={warning} className="bg-[#fff4d5] px-3 py-1 text-xs font-semibold text-[#725100]">{warning}</span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {!releaseSnapshot && (
                  <div className="p-4 text-sm leading-6 text-[#1d1a3e]/62">
                    Content release snapshots will appear after the generated release report is available in the web build.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white shadow-card">
              <div className="border-b border-[#1d1a3e]/8 p-5">
                <h2 className="font-display text-2xl font-semibold">Curriculum Content Readiness</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#1d1a3e]/62">
                  Every objective needs teaching design, runtime-approved activities, question variation, hints, explanations, mastery evidence and animation hooks before it should be treated as ready.
                </p>
              </div>
              <div className="grid gap-3 border-b border-[#1d1a3e]/8 p-5 text-sm md:grid-cols-4">
                <Info label="Objectives" value={String(readiness?.totals.objectives ?? 0)} />
                <Info label="Published activities" value={String(readiness?.totals.published_activities ?? 0)} />
                <Info label="Published questions" value={String(readiness?.totals.published_questions ?? 0)} />
                <Info label="Formats covered" value={String(readiness?.totals.formats ?? 0)} />
              </div>
              <div className="divide-y divide-[#1d1a3e]/8">
                {(readiness?.items ?? []).map((item) => (
                  <article key={item.objective_id} className="grid gap-4 p-5 lg:grid-cols-[1fr_180px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-semibold ${readinessBadgeClass(item.status)}`}>{item.status}</span>
                        <span className="bg-[#f6f3ea] px-3 py-1 text-xs font-semibold text-[#1d1a3e]/60">Y{item.year} / {item.subject}</span>
                        <span className="bg-[#55cbd3]/15 px-3 py-1 text-xs font-semibold text-[#155d64]">{item.strand} / {item.topic}</span>
                      </div>
                      <h3 className="mt-3 font-display text-xl font-semibold">{item.statement || item.objective_id}</h3>
                      <p className="mt-2 text-sm text-[#1d1a3e]/58">
                        {item.published_activity_count}/{item.activity_count} activities live / {item.published_question_count}/{item.question_count} questions live / {item.format_count} formats
                      </p>
                      {item.formats.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.formats.map((format) => (
                            <span key={format} className="bg-[#1d1a3e]/6 px-3 py-1 text-xs font-semibold text-[#1d1a3e]/66">{format}</span>
                          ))}
                        </div>
                      )}
                      {item.missing.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#b94747]">Missing</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.missing.map((missing) => (
                              <span key={missing} className="bg-[#ffe8e8] px-3 py-1 text-xs font-semibold text-[#8b2b2b]">{missing}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.warnings.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b6500]">Warnings</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.warnings.map((warning) => (
                              <span key={warning} className="bg-[#fff4d5] px-3 py-1 text-xs font-semibold text-[#725100]">{warning}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="self-start bg-[#f6f3ea] p-4">
                      <p className="font-display text-4xl font-semibold">{item.score}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1d1a3e]/45">readiness score</p>
                      <button
                        onClick={() => {
                          const objective = objectives.find((candidate) => candidate.id === item.objective_id) ?? {
                            id: item.objective_id,
                            year: item.year,
                            subject: item.subject,
                            strand: item.strand,
                            topic: item.topic,
                            statement: item.statement,
                            prerequisites: [],
                            misconceptions: [],
                            mastery: { expected: 80, secure: 90, retention_days: [], required_formats: [] },
                            parent_explanation: "",
                            teacher_evidence: "",
                          };
                          setTab("Objectives");
                          setObjectiveDraft({
                            ...objective,
                            prerequisitesText: pretty(objective.prerequisites ?? []),
                            misconceptionsText: pretty(objective.misconceptions ?? []),
                            retentionDaysText: pretty(objective.mastery?.retention_days ?? []),
                            requiredFormatsText: pretty(objective.mastery?.required_formats ?? []),
                          });
                        }}
                        className="btn-pop mt-4 w-full bg-white px-4 py-3 text-sm"
                      >
                        Open objective
                      </button>
                    </div>
                  </article>
                ))}
                {(readiness?.items ?? []).length === 0 && (
                  <div className="p-5 text-sm leading-6 text-[#1d1a3e]/62">
                    Load configuration to see objective readiness across teaching, assessment, animation and evidence coverage.
                  </div>
                )}
              </div>
            </section>
          </section>
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
          <EditorGrid
            left={
              <Panel title="Content Version Snapshots">
                {contentVersions.map((version) => {
                  const currentPayload = currentPayloadForVersion(version, config, objectives);
                  const diffFields = contentVersionDiffFields(version, currentPayload);
                  return (
                    <article key={version.id} className="grid gap-2 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{version.content_key}</p>
                          <p className="mt-1 text-sm text-[#1d1a3e]/58">{version.content_type}</p>
                        </div>
                        <span className="bg-[#55cbd3]/20 px-3 py-1 text-xs font-semibold text-[#155d64]">
                          v{version.version} / {version.status}
                        </span>
                      </div>
                      <p className="text-sm text-[#1d1a3e]/50">
                        Created {safeDate(version.created_at)}
                        {version.published_at ? ` / Published ${safeDate(version.published_at)}` : ""}
                      </p>
                      <p className="text-sm leading-6 text-[#1d1a3e]/62">
                        {currentPayload
                          ? diffFields.length === 0
                            ? "Matches the current live payload."
                            : `Differs from live payload: ${diffFields.slice(0, 6).join(", ")}${diffFields.length > 6 ? ` and ${diffFields.length - 6} more` : ""}.`
                          : "Current live item was not found; restoring would recreate it from this snapshot."}
                      </p>
                      <div className="flex flex-wrap justify-end gap-2">
                        {nextContentStatus(version.status) && (
                          <button
                            onClick={() => promoteContentVersion(version)}
                            disabled={!!saving}
                            className="btn-pop bg-[#55cbd3] px-4 py-2 text-sm font-semibold text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Promote to {nextContentStatus(version.status)}
                          </button>
                        )}
                        <button
                          onClick={() => restoreContentVersion(version)}
                          disabled={!!saving}
                          className="btn-pop bg-[#f6f3ea] px-4 py-2 text-sm font-semibold text-[#1d1a3e] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Restore snapshot
                        </button>
                      </div>
                    </article>
                  );
                })}
                {contentVersions.length === 0 && <p className="p-5 text-sm text-[#1d1a3e]/58">No content snapshots have been recorded yet.</p>}
              </Panel>
            }
            right={
              <Panel title="Recent Audit Events">
                {auditLogs.map((log) => (
                  <article key={log.id} className="grid gap-2 p-5 md:grid-cols-[160px_1fr]">
                    <p className="font-semibold">{log.action}</p>
                    <div>
                      <p className="text-sm text-[#1d1a3e]/62">{log.entity_type} / {log.entity_id}</p>
                      <p className="mt-1 text-sm text-[#1d1a3e]/50">{safeDate(log.created_at)}</p>
                    </div>
                  </article>
                ))}
                {auditLogs.length === 0 && <p className="p-5 text-sm text-[#1d1a3e]/58">No audit events have been recorded yet.</p>}
              </Panel>
            }
          />
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1d1a3e]/10 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#1d1a3e]/42">{label}</p>
      <p className="mt-1 break-words font-semibold text-[#1d1a3e]/78">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: "text" | "number" | "password" }) {
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

function currentPayloadForVersion(version: ContentVersion, config: AdminConfig | null, objectives: Objective[]): Record<string, unknown> | null {
  let payload: unknown;
  switch (version.content_type) {
    case "curriculum_objective":
      payload = objectives.find((objective) => objective.id === version.content_key);
      break;
    case "world":
      payload = config?.worlds?.find((world) => world.key === version.content_key);
      break;
    case "activity":
      payload = config?.activities?.find((activity) => activity.id === version.content_key);
      break;
    case "question":
      payload = config?.questions?.find((question) => question.id === version.content_key);
      break;
    case "reward_rule":
      payload = config?.reward_rules?.find((rule) => rule.id === version.content_key);
      break;
    default:
      return null;
  }
  if (!payload || typeof payload !== "object") return null;
  return payload as Record<string, unknown>;
}

function contentVersionDiffFields(version: ContentVersion, current: Record<string, unknown> | null) {
  if (!current || !version.payload) return [];
  return deepDiffPaths(version.payload, current);
}

function deepDiffPaths(left: unknown, right: unknown, path = ""): string[] {
  if (stableJSON(left) === stableJSON(right)) return [];
  if (Array.isArray(left) || Array.isArray(right)) return [path || "(root)"];
  if (left && right && typeof left === "object" && typeof right === "object") {
    const ignored = new Set(["created_at", "updated_at", "published_at"]);
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    return [...keys]
      .filter((key) => !ignored.has(key))
      .flatMap((key) => deepDiffPaths(leftRecord[key], rightRecord[key], path ? `${path}.${key}` : key))
      .sort();
  }
  return [path || "(root)"];
}

function nextContentStatus(status: string) {
  return ({
    draft: "review",
    review: "pilot",
    pilot: "approved",
    approved: "published",
    published: "live",
  } as Record<string, string>)[status] ?? "";
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJSON).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJSON(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function readinessBadgeClass(status: string) {
  switch (status) {
    case "ready":
      return "bg-[#dff7e7] text-[#17633a]";
    case "pilot":
      return "bg-[#e8e2ff] text-[#4e33a4]";
    case "draft":
      return "bg-[#fff4d5] text-[#725100]";
    case "blocked":
      return "bg-[#ffe8e8] text-[#8b2b2b]";
    default:
      return "bg-[#f6f3ea] text-[#1d1a3e]/62";
  }
}

function rendererBadgeClass(format: RendererReadinessFormat) {
  if (format.runtime_failures > 0) return "bg-[#ffe8e8] text-[#8b2b2b]";
  if (format.current_runtime.includes("ready")) return "bg-[#dff7e7] text-[#17633a]";
  if (format.current_runtime === "preview_only") return "bg-[#fff4d5] text-[#725100]";
  return "bg-[#e8e2ff] text-[#4e33a4]";
}

function assetBadgeClass(status: string) {
  switch (status) {
    case "production":
      return "bg-[#dff7e7] text-[#17633a]";
    case "pilot":
      return "bg-[#e8e2ff] text-[#4e33a4]";
    case "prototype":
      return "bg-[#dff4ff] text-[#155d64]";
    case "planned":
      return "bg-[#fff4d5] text-[#725100]";
    default:
      return "bg-[#f6f3ea] text-[#1d1a3e]/62";
  }
}

function pilotLaneBadgeClass(status: string) {
  switch (status) {
    case "required":
      return "bg-[#ffe8e8] text-[#8b2b2b]";
    case "conditional":
      return "bg-[#fff4d5] text-[#725100]";
    case "sample":
      return "bg-[#dff4ff] text-[#155d64]";
    default:
      return "bg-[#f6f3ea] text-[#1d1a3e]/62";
  }
}

function releaseBadgeClass(channel: string) {
  switch (channel) {
    case "release":
      return "bg-[#dff7e7] text-[#17633a]";
    case "pilot":
      return "bg-[#e8e2ff] text-[#4e33a4]";
    case "review":
      return "bg-[#dff4ff] text-[#155d64]";
    case "authoring":
      return "bg-[#fff4d5] text-[#725100]";
    default:
      return "bg-[#f6f3ea] text-[#1d1a3e]/62";
  }
}
