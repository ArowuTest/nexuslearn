import { engagementDefaults, supportNeeds, learningApproaches, supportChoices } from "./engagementProfileOptions";
export { engagementDefaults, supportNeeds, learningApproaches, supportChoices };

export type StudentEngagementProfile = Record<keyof typeof supportChoices, string> & {
  student_external_ref: string;
  declared_support_needs: string[];
  learning_approaches: string[];
  audio_support: boolean;
  reading_support: boolean;
  interests: string[];
  notes: string;
  updated_at?: string;
};

export function emptyEngagementProfile(studentExternalRef = ""): StudentEngagementProfile {
  return { ...engagementDefaults(), student_external_ref: studentExternalRef };
}

// Never replace missing saved settings with defaults or forward unrelated
// response fields into a pupil's next PUT. Server authorization remains required.
export function verifiedEngagementProfile(value: unknown, studentExternalRef: string): StudentEngagementProfile {
  const invalid = () => new Error("The pupil support profile could not be verified.");
  if (!studentExternalRef.trim() || !value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  if (row.student_external_ref !== studentExternalRef) throw invalid();
  const defaults = emptyEngagementProfile(studentExternalRef);
  for (const [key, expected] of Object.entries(defaults)) {
    const actual = row[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || actual.some(item => typeof item !== "string")) throw invalid();
    } else if (typeof actual !== typeof expected) throw invalid();
  }
  for (const [key, allowed] of Object.entries(supportChoices)) if (!allowed.includes(row[key] as string)) throw invalid();
  for (const [key, allowed] of [["declared_support_needs", supportNeeds], ["learning_approaches", learningApproaches]] as const) {
    if ((row[key] as string[]).some(item => !allowed.includes(item))) throw invalid();
  }
  if ((row.interests as string[]).some(item => !item.trim())) throw invalid();
  if (row.updated_at !== undefined && (typeof row.updated_at !== "string" || row.updated_at !== "" && !Number.isFinite(Date.parse(row.updated_at)))) throw invalid();
  const result = Object.fromEntries(Object.keys(defaults).map(key => {
    const actual = row[key];
    return [key, Array.isArray(actual) ? [...actual] : actual];
  })) as StudentEngagementProfile;
  if (typeof row.updated_at === "string") result.updated_at = row.updated_at;
  return result;
}
