import { supportResponse, type SupportAttempt } from "./schoolSupportProfile";

export type SupportRequest = (path: string, options: RequestInit) => Promise<{ status: number; body: unknown }>;

// The page's account-scoped request still owns auth, timeout and account aborts.
// This owner also cancels on pupil changes and ignores even non-cooperative IO.
export function createSupportTransport() {
  let active: AbortController | null = null;
  const cancel = () => { active?.abort(); active = null; };
  return {
    cancel,
    busy: () => active !== null,
    async run(request: SupportRequest, pupil: string, attempt?: SupportAttempt) {
      cancel();
      const controller = new AbortController();
      active = controller;
      const current = () => active === controller && !controller.signal.aborted;
      try {
        const response = await request(`/v1/school/students/${encodeURIComponent(pupil)}/engagement`, {
          signal: controller.signal, cache: "no-store",
          ...(attempt ? { method: "PUT", headers: { "Idempotency-Key": attempt.key }, body: attempt.body } : {}),
        });
        return current() ? supportResponse(response.status, response.body, pupil, attempt ? JSON.parse(attempt.body).version : undefined) : null;
      } catch {
        return current() ? { type: "failure" as const, message: attempt
          ? "The save was not confirmed. Your draft is kept; retry the same settings safely."
          : "The support profile could not be loaded. Please retry." } : null;
      } finally { if (active === controller) active = null; }
    },
  };
}
