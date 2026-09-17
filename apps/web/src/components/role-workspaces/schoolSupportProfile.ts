import { engagementDefaults, supportNeeds, learningApproaches, supportChoices, supportNeedOptions, familyApproachOptions } from "./engagementProfileOptions";
export { engagementDefaults, supportNeeds, learningApproaches, supportChoices };

export type StudentEngagementProfile = Record<keyof typeof supportChoices, string> & {
  student_external_ref: string;
  version: number;
  declared_support_needs: string[];
  learning_approaches: string[];
  audio_support: boolean;
  reading_support: boolean;
  interests: string[];
  notes: string;
  updated_at?: string;
};

export function emptyEngagementProfile(studentExternalRef = ""): StudentEngagementProfile {
  return { ...engagementDefaults(), student_external_ref: studentExternalRef, version: 0 };
}

const invalid = () => new Error("The pupil support profile could not be verified.");
const validVersion = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
};

// Never replace missing saved settings with defaults or forward unrelated
// response fields into a pupil's next PUT. Server authorization remains required.
export function verifiedEngagementProfile(value: unknown, studentExternalRef: string): StudentEngagementProfile {
  const row = record(value);
  if (!studentExternalRef.trim() || row.student_external_ref !== studentExternalRef || !validVersion(row.version)) throw invalid();
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

export function verifiedSupportSave(value: unknown, pupil: string, base: number) {
  const profile = verifiedEngagementProfile(value, pupil);
  const receipt = record(record(value).save_result);
  if (!validVersion(base) || profile.version === 0 || receipt.applied_version !== profile.version || typeof receipt.changed !== "boolean" || typeof receipt.replayed !== "boolean" ||
    (receipt.changed ? profile.version <= base : profile.version !== base)) throw invalid();
  return { profile, replayed: receipt.replayed };
}

export function verifiedSupportConflict(value: unknown, pupil: string) {
  const row = record(value);
  if (row.code !== "support_profile_conflict" || typeof row.error !== "string" || typeof row.previously_saved !== "boolean") throw invalid();
  return { current: verifiedEngagementProfile(row.current_profile, pupil), previouslySaved: row.previously_saved };
}

export type SupportAttempt = { body: string; key: string };
const interestsList = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
export function prepareSupportSave(draft: StudentEngagementProfile, interests: string, previous: SupportAttempt | null, newKey = () => crypto.randomUUID()): SupportAttempt {
  const profile = verifiedEngagementProfile({ ...draft, interests: interestsList(interests) }, draft.student_external_ref);
  delete profile.updated_at;
  const body = JSON.stringify(profile);
  return previous?.body === body ? previous : { body, key: newKey() };
}

type Review = { current: StudentEngagementProfile | null; previouslySaved: boolean };
export type SupportState = {
  base: StudentEngagementProfile | null;
  draft: StudentEngagementProfile;
  interests: string;
  ready: boolean;
  review: Review | null;
  confirm: boolean;
  pending: SupportAttempt | null;
};
export type SupportEvent =
  | { type: "reset"; pupil?: string }
  | { type: "loaded" | "saved"; profile: StudentEngagementProfile }
  | { type: "edit"; patch?: Partial<StudentEngagementProfile>; interests?: string }
  | { type: "conflict"; locked?: boolean } & Review
  | { type: "pending"; attempt: SupportAttempt }
  | { type: "loading" | "confirm" | "cancel" | "rebase" | "discard" };

export function supportReadNeedsReview(state: SupportState): boolean {
  return Boolean(state.review || state.pending || state.base && (
    state.interests !== state.base.interests.join(", ") || supportDifferences(state.base, state.draft, state.interests).length
  ));
}

// Base, draft, comparison and uncertain attempt are separate, memory-only values.
// No transition performs IO. Rebase and confirmed discard always require a later save.
export function supportEditorState(state: SupportState | null, event: SupportEvent): SupportState {
  if (!state || event.type === "reset") {
    state = { base: null, draft: emptyEngagementProfile(event.type === "reset" ? event.pupil : ""), interests: "", ready: false, review: null, confirm: false, pending: null };
  }
  switch (event.type) {
    case "loaded":
      if (supportReadNeedsReview(state)) return { ...state, review: { previouslySaved: state.review?.previouslySaved ?? false, current: event.profile }, confirm: false };
    // A verified save replaces the draft only after its receipt has been checked.
    case "saved":
      return { base: event.profile, draft: verifiedEngagementProfile(event.profile, event.profile.student_external_ref), interests: event.profile.interests.join(", "), ready: true, review: null, confirm: false, pending: null };
    case "loading": {
      const protect = supportReadNeedsReview(state);
      return { ...state, ready: protect ? state.ready : false, review: protect ? { previouslySaved: state.review?.previouslySaved ?? false, current: null } : null, confirm: false };
    }
    case "edit":
      return { ...state, draft: { ...state.draft, ...event.patch }, interests: event.interests ?? state.interests, confirm: false };
    case "pending": return { ...state, pending: event.attempt };
    // A rejected request is not an uncertain success. Deliberate recovery needs
    // a fresh key, even when a comparison returns the same saved version.
    case "conflict": return { ...state, review: { current: event.current, previouslySaved: event.previouslySaved }, ready: event.locked ? false : state.ready, confirm: false, pending: null };
    case "confirm": return state.review?.current ? { ...state, confirm: true } : state;
    case "cancel": return { ...state, confirm: false };
    case "discard":
      return state.confirm && state.review?.current ? supportEditorState(state, { type: "saved", profile: state.review.current }) : state;
    case "rebase":
      return state.review?.current ? { ...state, base: state.review.current, draft: { ...state.draft, version: state.review.current.version }, ready: true, review: null, confirm: false, pending: state.review.current.version === state.draft.version ? state.pending : null } : state;
    default: return state;
  }
}

type SupportOutcome = (SupportEvent & { message: string }) | { type: "denied"; message: string } | { type: "failure"; message: string };
export function supportResponse(status: number, body: unknown, pupil: string, base?: number): SupportOutcome {
  if (status === 401 || status === 403) return { type: "denied", message: "Your school access changed. Sign in again to continue." };
  if (base !== undefined && (status === 409 || status === 428)) {
    const unverified = { type: "conflict", current: null, previouslySaved: false } as const;
    if (status === 428) return { ...unverified, locked: true, message: "A compatible versioned profile must be loaded and reviewed. Your draft is kept." };
    try {
      const conflict = verifiedSupportConflict(body, pupil);
      return { type: "conflict", ...conflict, message: conflict.previouslySaved
        ? "Your earlier save succeeded, but newer settings have since replaced it. Your draft is kept for review."
        : "Settings changed elsewhere. Your draft is kept. Review the saved settings before saving again." };
    } catch {
      return { ...unverified, message: "The conflict could not be verified. Your draft is kept. Refresh saved settings for comparison." };
    }
  }
  if (status === 200) {
    try {
      if (base === undefined) return { type: "loaded", profile: verifiedEngagementProfile(body, pupil), message: "Pupil support profile loaded." };
      const saved = verifiedSupportSave(body, pupil, base);
      return { type: "saved", profile: saved.profile, message: saved.replayed ? "Earlier support save confirmed. These are the current saved settings." : "Pupil support profile saved." };
    } catch { return { type: "failure", message: "The support response could not be verified. Your draft is kept." }; }
  }
  return { type: "failure", message: base === undefined ? "The support profile could not be loaded. Please retry." : "The save was not confirmed. Your draft is kept; retry the same settings safely." };
}

export const supportFieldLabels = {
  declared_support_needs: "Declared support needs", learning_approaches: "Learning and access approaches",
  session_length: "Session length", sensory_load: "Sensory load", attention_support: "Attention support",
  communication_support: "Communication support", processing_support: "Processing support", confidence_support: "Confidence support",
  celebration_intensity: "Celebrations", companion_style: "Companion style", reward_style: "Reward style",
  audio_support: "Audio support", reading_support: "Reading support", interests: "Interests", notes: "Operational notes",
};
const choiceLabels: Record<string, string> = Object.fromEntries([...supportNeedOptions, ...familyApproachOptions]);
const friendly = (value: string) => choiceLabels[value] ?? value.replace(/_/g, " ").replace(/^./, char => char.toUpperCase());
export function supportDifferences(saved: StudentEngagementProfile, draft: StudentEngagementProfile, interests: string): string[][] {
  return (Object.keys(supportFieldLabels) as Array<keyof typeof supportFieldLabels>).flatMap(key => {
    const left = saved[key], right = key === "interests" ? interestsList(interests) : draft[key];
    const display = (value: typeof left) => typeof value === "boolean" ? value ? "On" : "Off"
      : Array.isArray(value) ? value.map(item => key === "interests" ? item : friendly(item)).join(", ") || "None"
      : key === "notes" ? value || "None" : friendly(value);
    return JSON.stringify(left) === JSON.stringify(right) ? [] : [[supportFieldLabels[key], display(left), display(right)]];
  });
}
