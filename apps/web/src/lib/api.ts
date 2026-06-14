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
  questions: MissionQuestion[];
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

const API = process.env.NEXT_PUBLIC_API_URL;
export const DEFAULT_STUDENT_ID = process.env.NEXT_PUBLIC_DEMO_STUDENT_ID || "alex-demo";

async function getJSON<T>(path: string): Promise<T | null> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: 30 } });
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
  return getJSON<StudentProfile>(`/v1/students/${encodeURIComponent(studentId)}/profile`);
}

export async function getMastery(studentId: string): Promise<Mastery[] | null> {
  const data = await getJSON<{ mastery: Mastery[] }>(`/v1/students/${studentId}/mastery`);
  return data?.mastery ?? null;
}

export async function getRecentAttempts(studentId: string): Promise<RecentAttempt[] | null> {
  const data = await getJSON<{ attempts: RecentAttempt[] }>(`/v1/students/${studentId}/attempts`);
  return data?.attempts ?? null;
}

export async function getEvidenceSummary(studentId: string): Promise<EvidenceSummary | null> {
  return getJSON<EvidenceSummary>(`/v1/students/${studentId}/summary`);
}

export async function getNextActivity(studentId: string): Promise<NextActivityDecision | null> {
  return getJSON<NextActivityDecision>(`/v1/learning/next?studentId=${encodeURIComponent(studentId)}`);
}

export async function getMissionConfig(studentId = DEFAULT_STUDENT_ID, activityId?: string): Promise<MissionConfig | null> {
  const params = new URLSearchParams({ studentId });
  if (activityId) params.set("activityId", activityId);
  return getJSON<MissionConfig>(`/v1/learning/mission?${params.toString()}`);
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
  return body as ParentAccount;
}

export async function getParentPortal(loginID: string, password: string): Promise<ParentPortal> {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parent/config`, {
    headers: { "X-Parent-Login": loginID, "X-Parent-Password": password },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not load parent account.");
  return body as ParentPortal;
}

export async function createParentChild(loginID: string, password: string, child: { external_ref: string; display_name: string; year_group: number; engagement: StudentEngagementProfile }) {
  if (!API) throw new Error("The NexusLearn API is not configured yet.");
  const res = await fetch(`${API}/v1/parent/children/${encodeURIComponent(child.external_ref)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Parent-Login": loginID, "X-Parent-Password": password },
    body: JSON.stringify(child),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not create child profile.");
  return body;
}
