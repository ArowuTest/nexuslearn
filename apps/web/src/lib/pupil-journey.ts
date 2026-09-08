import { clearPupilSession, pupilSessionHeaders, type NextActivityDecision, type ProgressReport, type StudentProfile, type WorldState } from "./api";

export type PupilJourney = { studentId: string; profile: StudentProfile; next: NextActivityDecision | null; progress: ProgressReport | null; world: WorldState | null; worldName: string };
export type PupilJourneyView = { kind: "loading" | "access" | "unavailable" | "paused" } | { kind: "ready"; data: PupilJourney };

// A URL is not a pupil identity. The API still validates the signed token on
// every private read; storage is only a hint about which session to request.
export function currentPupilId() {
  try {
    const id = sessionStorage.getItem("nexuslearn_pupil_id") || "";
    const expiry = sessionStorage.getItem("nexuslearn_pupil_session_expires");
    if (expiry && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) {
      clearPupilSession();
      return "";
    }
    return id && pupilSessionHeaders(id)["X-Pupil-Session"] ? id : "";
  } catch { return ""; }
}

export async function loadPupilJourney(signal: AbortSignal): Promise<PupilJourneyView> {
  const studentId = currentPupilId();
  if (!studentId) return { kind: "access" };
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return { kind: "unavailable" };
  const headers = pupilSessionHeaders(studentId);
  const pending = new Set<AbortController>();
  const sameSession = () => {
    try { return currentPupilId() === studentId && pupilSessionHeaders(studentId)["X-Pupil-Session"] === headers["X-Pupil-Session"]; }
    catch { return false; }
  };
  // Each optional panel has its own deadline. An unavailable progress service
  // must not cancel a successfully authorised profile and next activity.
  async function read<T>(path: string, privateRead = true, timeoutMs = 4_000): Promise<T | null> {
    const request = new AbortController();
    pending.add(request);
    const cancel = () => request.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, timeoutMs);
    try {
      signal.throwIfAborted();
      const response = await fetch(`${api}${path}`, { signal: request.signal, cache: "no-store", headers: privateRead ? headers : {} });
      signal.throwIfAborted();
      if (privateRead && [401, 403].includes(response.status)) throw new Error("access");
      const result = response.ok ? await response.json() as T : null;
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.message === "access")) throw error;
      return null;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      pending.delete(request);
    }
  }
  try {
    const settings = await read<{ flags?: Record<string, boolean> }>("/v1/runtime/flags", false);
    if (!settings?.flags) return { kind: "unavailable" };
    if (settings.flags.child_play_enabled === false) return { kind: "paused" };
    const pupilPath = `/v1/students/${encodeURIComponent(studentId)}`;
    const core = async () => {
      const [profile, next] = await Promise.all([
        read<StudentProfile>(`${pupilPath}/profile`),
        read<NextActivityDecision>(`/v1/learning/next?studentId=${encodeURIComponent(studentId)}`),
      ]);
      if (!profile) return null;
      const worldKey = next?.world_key || profile.active_world_key;
      const worldName = (next?.world_key && next.world) || (worldKey === profile.active_world_key && profile.active_world) || "Your learning world";
      const saved = worldKey ? await read<WorldState>(`${pupilPath}/world?worldKey=${encodeURIComponent(worldKey)}`, true, 2_000) : null;
      const world = saved?.world_key === worldKey ? saved : null;
      return { profile, next, world, worldName };
    };
    const [route, progress] = await Promise.all([core(), read<ProgressReport>(`${pupilPath}/progress`, true, 2_000)]);
    if (!sameSession()) return { kind: "access" };
    if (!route) return { kind: "unavailable" };
    return { kind: "ready", data: { studentId, ...route, progress } };
  } catch (error) {
    if (error instanceof Error && error.message === "access") {
      // A late denial belongs to the captured session, never a replacement
      // card (including a new token for the same pupil).
      if (!signal.aborted && sameSession()) clearPupilSession();
      return { kind: "access" };
    }
    return { kind: "unavailable" };
  } finally {
    for (const request of pending) request.abort();
  }
}

export function pupilMissionURL(data: Pick<PupilJourney, "studentId" | "next">) {
  const next = data.next;
  if (!next?.activity_id || !["teach", "practice", "review", "diagnostic", "assessment"].includes(next.assessment_mode)) return "";
  return `/play/mission?${new URLSearchParams({ studentId: data.studentId, activityId: next.activity_id, mode: next.assessment_mode })}`;
}
