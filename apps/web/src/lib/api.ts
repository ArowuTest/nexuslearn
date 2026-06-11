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

export type Mastery = {
  student_id: string;
  objective_id: string;
  score: number;
  band: string;
  last_signal: string;
  next_review_due: string;
};

export type NextActivityDecision = {
  objective_id: string;
  activity_id: string;
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

const API = process.env.NEXT_PUBLIC_API_URL;

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

export async function getMastery(studentId: string): Promise<Mastery[] | null> {
  const data = await getJSON<{ mastery: Mastery[] }>(`/v1/students/${studentId}/mastery`);
  return data?.mastery ?? null;
}

export async function getNextActivity(studentId: string): Promise<NextActivityDecision | null> {
  return getJSON<NextActivityDecision>(`/v1/learning/next?studentId=${encodeURIComponent(studentId)}`);
}
