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
