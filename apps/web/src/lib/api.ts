export type Objective = {
  id: string;
  year: number;
  subject: string;
  strand: string;
  topic: string;
  statement: string;
  prerequisites: string[];
  misconceptions: string[];
  parent_explanation: string;
  teacher_evidence: string;
};

export type CurriculumMap = {
  years: Array<{
    year: number;
    subjects: Array<{
      name: string;
      total: number;
      strands: Array<{ name: string; topics: string[]; objectives: number }>;
    }>;
    total: number;
  }>;
  subjects: Array<{
    name: string;
    total: number;
    strands: Array<{ name: string; topics: string[]; objectives: number }>;
  }>;
  total: number;
  generated_at: string;
};

export type Mastery = {
  student_id: string;
  objective_id: string;
  score: number;
  band: string;
  last_signal: string;
  next_review_due: string;
  evidence_count: number;
  format_count: number;
  independent_correct_count: number;
  retained_success_count: number;
  evidence_confidence: "limited" | "emerging" | "supported" | "strong";
  effective_evidence_score: number;
  evidence_freshness: "current" | "aging" | "stale";
  last_evidence_at?: string;
};

export type RecentAttempt = {
  student_id: string;
  objective_id: string;
  question_id: string;
  correct: boolean;
  response_ms: number;
  hint_used: boolean;
  mastery_delta: number;
  explanation: string;
  attempted_at: string;
  animation_hook: string;
};

export type EvidenceSummary = {
  student_id: string;
  attempts_7_days: number;
  correct_7_days: number;
  accuracy_7_days: number;
  due_reviews: number;
  open_reviews: number;
  misconceptions_repaired: number;
  teacher_evidence_count: number;
  active_interventions: number;
  bands: Record<string, number>;
  updated_at: string;
};

export type NextActivityDecision = {
  student_id: string;
  objective_id: string;
  activity_id: string;
  world_key: string;
  world: string;
  realm: string;
  interaction: string;
  difficulty: number;
  scaffold: boolean;
  review: boolean;
  prerequisite_probe: boolean;
  reward_hook: string;
  animation_hook: string;
  explanation: string;
  companion_prompt: string;
  recommended_actions: string[];
  runtime_adaptations: RuntimeAdaptations;
};

export type RuntimeAdaptations = {
  animation_tier: "full" | "standard" | "low" | "static";
  reduced_motion: boolean;
  celebration_intensity: "quiet" | "balanced" | "big";
  session_length: "short" | "standard" | "extended";
  question_limit: number;
  scaffold_level: "standard" | "chunked" | "high_structure" | "step_by_step";
  audio_support: boolean;
  reading_support: boolean;
  companion_style: "friendly" | "funny" | "calm" | "coach";
  reward_style: "world_building" | "collecting" | "story" | "challenge";
  reasons: string[];
};

export type RuntimeFlags = {
  flags: Record<string, boolean>;
  config: Record<string, Record<string, unknown>>;
  generated_at: string;
};

export type WorldConfig = {
  key: string;
  name: string;
  year_group: number;
  theme: string;
  config: Record<string, string | number | boolean>;
  enabled: boolean;
};

export type StudentProfile = {
  student_id: string;
  display_name: string;
  year_group: number;
  active_world: string;
  active_realm: string;
  active_world_key: string;
  companion_name: string;
  accessibility_mode: string;
  next_activity_id: string;
};

export type MissionQuestion = {
  id: string;
  activity_id: string;
  objective_id: string;
  format: string;
  body: Record<string, unknown>;
  expected_answer: Record<string, unknown>;
  hints: string[];
  explanation: string;
  difficulty: number;
  status: string;
  selection_reason?: string;
};

export type MissionConfig = {
  student_id: string;
  activity: {
    id: string;
    objective_id: string;
    template_id: string;
    world_key: string;
    title: string;
    prompt: string;
    difficulty: number;
    interaction: Record<string, unknown>;
    feedback: Record<string, unknown>;
    animation_hooks: Record<string, unknown>;
    status: string;
  };
  objective: Objective;
  world: WorldConfig;
  world_state?: {
    student_id: string;
    world_key: string;
    state: Record<string, unknown>;
    updated_at: string;
  };
  questions: MissionQuestion[];
  assessment_blueprint: {
    mode: "teach" | "practice" | "review" | "diagnostic" | "assessment";
    question_count: number;
    target_difficulty: number;
    formats: string[];
    rationale: string[];
  };
  runtime_adaptations: RuntimeAdaptations;
};

export type AccessRequest = {
  id?: string;
  request_type: "parent" | "school" | "tutor_org";
  organisation_name: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  role: string;
  region: string;
  learner_count: number;
  year_groups: number[];
  support_needs: string[];
  learning_priorities: string[];
  message: string;
  status?: string;
  source?: string;
};

export type StudentEngagementProfile = {
  student_external_ref?: string;
  declared_support_needs: string[];
  learning_approaches: string[];
  celebration_intensity: "quiet" | "balanced" | "big";
  audio_support: boolean;
  reading_support: boolean;
  session_length: "short" | "standard" | "extended";
  sensory_load: "low" | "balanced" | "high";
  attention_support: "standard" | "chunked" | "high_structure";
  communication_support: "standard" | "visual" | "audio_visual";
  processing_support: "standard" | "extra_time" | "step_by_step";
  confidence_support: "gentle" | "balanced" | "challenge";
  companion_style: "friendly" | "funny" | "calm" | "coach";
  reward_style: "world_building" | "collecting" | "story" | "challenge";
  interests: string[];
  notes: string;
};

export type ParentAccount = {
  email: string;
  display_name: string;
  login_id?: string;
  password?: string;
  temporary_password?: string;
};

export type ParentPortal = {
  parent: ParentAccount;
  children: Array<{
    student: StudentProfile & { external_ref?: string };
    credential: { student_external_ref: string; login_code: string; picture_password: string[] };
    engagement: StudentEngagementProfile;
  }>;
};

export type ParentChildEvidence = {
  child: ParentPortal["children"][number];
  mastery: Mastery[];
  attempts: RecentAttempt[];
  summary: EvidenceSummary;
  next_activity?: NextActivityDecision | null;
};

export type PupilLoginResult = {
  student: {
    external_ref: string;
    display_name: string;
    year_group: number;
  };
  session?: {
    configured: boolean;
    token?: string;
    token_type: "pupil";
    expires_at?: string;
    expires_in_seconds?: number;
  };
  next_activity?: NextActivityDecision;
};

const API = process.env.NEXT_PUBLIC_API_URL;
export const DEFAULT_STUDENT_ID = process.env.NEXT_PUBLIC_DEMO_STUDENT_ID || "";
const PUPIL_SESSION_KEY = "nexuslearn_pupil_session";
const PUPIL_SESSION_STUDENT_KEY = "nexuslearn_pupil_id";
const PUPIL_SESSION_EXPIRES_KEY = "nexuslearn_pupil_session_expires";
const ACCOUNT_SESSION_KEY = "nexuslearn_account_session";
const ACCOUNT_SESSION_ROLE_KEY = "nexuslearn_account_role";
const ACCOUNT_SESSION_EXPIRES_KEY = "nexuslearn_account_session_expires";

export type AccountSession = {
  token: string;
  token_type: string;
  role: string;
  school_urn?: string;
  expires_at: string;
  expires_in_seconds: number;
};

type FetchOptions = {
  headers?: Record<string, string>;
};

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

export function storePupilSession(result: PupilLoginResult) {
  if (!storageAvailable() || !result.session?.token || !result.student?.external_ref) return;
  sessionStorage.setItem(PUPIL_SESSION_KEY, result.session.token);
  sessionStorage.setItem(PUPIL_SESSION_STUDENT_KEY, result.student.external_ref);
  if (result.session.expires_at) sessionStorage.setItem(PUPIL_SESSION_EXPIRES_KEY, result.session.expires_at);
  else sessionStorage.removeItem(PUPIL_SESSION_EXPIRES_KEY);
}

export function clearPupilSession() {
  if (!storageAvailable()) return;
  sessionStorage.removeItem(PUPIL_SESSION_KEY);
  sessionStorage.removeItem(PUPIL_SESSION_STUDENT_KEY);
  sessionStorage.removeItem(PUPIL_SESSION_EXPIRES_KEY);
}

export function pupilSessionHeaders(studentId: string): Record<string, string> {
  if (!storageAvailable()) return {};
  const token = sessionStorage.getItem(PUPIL_SESSION_KEY);
  const tokenStudent = sessionStorage.getItem(PUPIL_SESSION_STUDENT_KEY);
  const expiresAt = sessionStorage.getItem(PUPIL_SESSION_EXPIRES_KEY);
  if (expiresAt && Date.now() > Date.parse(expiresAt)) {
    clearPupilSession();
    return {};
  }
  if (!token || !tokenStudent || tokenStudent !== studentId) return {};
  return { "X-Pupil-Session": token };
}

export function storeAccountSession(session?: AccountSession) {
  if (!storageAvailable() || !session?.token) return;
  sessionStorage.setItem(ACCOUNT_SESSION_KEY, session.token);
  sessionStorage.setItem(ACCOUNT_SESSION_ROLE_KEY, session.role);
  sessionStorage.setItem(ACCOUNT_SESSION_EXPIRES_KEY, session.expires_at);
}

export function clearAccountSession() {
  if (!storageAvailable()) return;
  sessionStorage.removeItem(ACCOUNT_SESSION_KEY);
  sessionStorage.removeItem(ACCOUNT_SESSION_ROLE_KEY);
  sessionStorage.removeItem(ACCOUNT_SESSION_EXPIRES_KEY);
}

export function accountSessionHeaders(roles: string[] = []): Record<string, string> {
  if (!storageAvailable()) return {};
  const token = sessionStorage.getItem(ACCOUNT_SESSION_KEY);
  const role = sessionStorage.getItem(ACCOUNT_SESSION_ROLE_KEY);
  const expiresAt = sessionStorage.getItem(ACCOUNT_SESSION_EXPIRES_KEY);
  if (expiresAt && Date.now() >= Date.parse(expiresAt)) {
    clearAccountSession();
    return {};
  }
  if (!token || !role || (roles.length > 0 && !roles.includes(role))) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function logoutAccount() {
  if (!API) return;
  const headers = accountSessionHeaders();
  try {
    if (headers.Authorization) {
      await fetch(`${API}/v1/auth/logout`, { method: "POST", headers });
    }
  } finally {
    clearAccountSession();
  }
}

async function getJSON<T>(path: string, options: FetchOptions = {}): Promise<T | null> {
  if (!API) return null;
  try {
    const hasPrivateHeaders = Object.keys(options.headers ?? {}).length > 0;
    const init: RequestInit & { next?: { revalidate: number } } = hasPrivateHeaders
      ? { headers: options.headers, cache: "no-store" }
      : { next: { revalidate: 30 } };
    const res = await fetch(`${API}${path}`, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getObjectives(): Promise<Objective[] | null> {
  const data = await getJSON<{ objectives: Objective[] }>("/v1/curriculum/objectives");
  return data?.objectives ?? null;
}

export async function getCurriculumMap(): Promise<CurriculumMap | null> {
  return getJSON<CurriculumMap>("/v1/curriculum/map");
}

export async function getWorlds(): Promise<WorldConfig[] | null> {
  const data = await getJSON<{ worlds: WorldConfig[] }>("/v1/learning/worlds");
  return data?.worlds ?? null;
}

export async function getRuntimeFlags(): Promise<RuntimeFlags | null> {
  return getJSON<RuntimeFlags>("/v1/runtime/flags");
}

export async function getStudentProfile(studentId = DEFAULT_STUDENT_ID): Promise<StudentProfile | null> {
  if (!studentId) return null;
  return getJSON<StudentProfile>(`/v1/students/${encodeURIComponent(studentId)}/profile`, { headers: pupilSessionHeaders(studentId) });
}

export async function getMastery(studentId: string): Promise<Mastery[] | null> {
  if (!studentId) return null;
  const data = await getJSON<{ mastery: Mastery[] }>(`/v1/students/${encodeURIComponent(studentId)}/mastery`, { headers: pupilSessionHeaders(studentId) });
  return data?.mastery ?? null;
}

export async function getRecentAttempts(studentId: string): Promise<RecentAttempt[] | null> {
  if (!studentId) return null;
  const data = await getJSON<{ attempts: RecentAttempt[] }>(`/v1/students/${encodeURIComponent(studentId)}/attempts`, { headers: pupilSessionHeaders(studentId) });
  return data?.attempts ?? null;
}

export async function getEvidenceSummary(studentId: string): Promise<EvidenceSummary | null> {
  if (!studentId) return null;
  return getJSON<EvidenceSummary>(`/v1/students/${encodeURIComponent(studentId)}/summary`, { headers: pupilSessionHeaders(studentId) });
}

export async function getNextActivity(studentId: string): Promise<NextActivityDecision | null> {
  if (!studentId) return null;
  return getJSON<NextActivityDecision>(`/v1/learning/next?studentId=${encodeURIComponent(studentId)}`, { headers: pupilSessionHeaders(studentId) });
}

export async function getMissionConfig(studentId = DEFAULT_STUDENT_ID, activityId?: string): Promise<MissionConfig | null> {
  if (!studentId) return null;
  const params = new URLSearchParams({ studentId });
  if (activityId) params.set("activityId", activityId);
  return getJSON<MissionConfig>(`/v1/learning/mission?${params.toString()}`, { headers: pupilSessionHeaders(studentId) });
}

export async function submitAccessRequest(request: AccessRequest): Promise<AccessRequest> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/access-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not submit the access request.");
  return body as AccessRequest;
}

export async function createParentAccount(parent: ParentAccount): Promise<ParentAccount> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parents/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parent),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not create parent account.");
  const result = body as { parent: ParentAccount; session?: AccountSession };
  storeAccountSession(result.session);
  return result.parent;
}

export async function parentLogin(loginID: string, password: string): Promise<ParentAccount> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/auth/parent-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login_id: loginID, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not log in.");
  const result = body as { parent: ParentAccount; session?: AccountSession };
  storeAccountSession(result.session);
  return result.parent;
}

export async function getParentPortal(): Promise<ParentPortal> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parent/config`, {
    headers: accountSessionHeaders(["parent"]),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not load parent account.");
  return body as ParentPortal;
}

export async function getParentChildEvidence(externalRef: string): Promise<ParentChildEvidence> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parent/children/${encodeURIComponent(externalRef)}/evidence`, {
    headers: accountSessionHeaders(["parent"]),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not load child evidence.");
  return body as ParentChildEvidence;
}

export async function createParentChild(child: { external_ref: string; display_name: string; year_group: number; engagement: StudentEngagementProfile }) {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parent/children/${encodeURIComponent(child.external_ref)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...accountSessionHeaders(["parent"]) },
    body: JSON.stringify(child),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not create child profile.");
  return body;
}

export async function acceptParentInvitation(payload: { token: string; display_name: string; password: string }): Promise<ParentAccount> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parent/invitations/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not accept invitation.");
  const result = body as { parent: ParentAccount; session?: AccountSession };
  storeAccountSession(result.session);
  return result.parent;
}

export async function pupilLogin(payload: { student_external_ref: string; login_code: string; picture_password: string[]; qr_secret_hash?: string }): Promise<PupilLoginResult> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/auth/pupil-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not log in.");
  return body as PupilLoginResult;
}
