"use client";

import { useEffect, useRef, useState } from "react";
import { accountSessionHeaders, subscribeAccountSession } from "@/lib/api";

const authorization = () => accountSessionHeaders(["school_admin", "teacher"]).Authorization ?? "";
type PendingSave = { path: string; body: string; pupil: string };

// Shared by pupil-keyed teacher tasks and reassessments. A successful mutation
// and its subsequent read are different outcomes; only the former resets a draft.
export function useSchoolSave({ disabled, request, onSaved, onBusyChange, resetDraft, savedMessage }: {
  disabled: boolean;
  request: (path: string, options: RequestInit) => Promise<unknown>;
  onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void;
  resetDraft: () => void; savedMessage: string;
}) {
  const [owner] = useState(authorization);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [expired, setExpired] = useState(false);
  const version = useRef(0);
  const inFlight = useRef(false);
  const invalidated = useRef(false);
  const key = useRef({ fingerprint: "", value: "" });

  useEffect(() => () => { version.current++; if (inFlight.current) onBusyChange(false); }, [onBusyChange]);
  useEffect(() => subscribeAccountSession(() => {
    if (invalidated.current || owner === authorization()) return;
    invalidated.current = true; version.current++;
    setExpired(true); resetDraft(); setMessage(""); setRefreshFailed(false);
    key.current = { fingerprint: "", value: "" };
    if (inFlight.current) { inFlight.current = false; onBusyChange(false); }
  }), [owner, onBusyChange, resetDraft]);

  async function perform(save?: PendingSave) {
    if (disabled || inFlight.current || expired || (!save && !refreshFailed)) return;
    if (!owner || owner !== authorization()) { setExpired(true); resetDraft(); return; }
    const stamp = version.current;
    const current = () => stamp === version.current && owner === authorization();
    inFlight.current = true; onBusyChange(true); setFailed(false);
    let confirmed = !save;
    try {
      if (save) {
        const fingerprint = `${owner}:${save.pupil}:${save.path}:${save.body}`;
        if (key.current.fingerprint !== fingerprint || !key.current.value) key.current = { fingerprint, value: crypto.randomUUID() };
        setMessage("Saving…"); setRefreshFailed(false);
        await request(save.path, { method: "POST", body: save.body, headers: { "Idempotency-Key": key.current.value } });
        if (!current()) return;
        confirmed = true; key.current = { fingerprint: "", value: "" };
        resetDraft(); setMessage(savedMessage);
      }
      await onSaved();
      if (current()) { setMessage(savedMessage); setRefreshFailed(false); }
    } catch {
      if (current()) {
        setFailed(true); setRefreshFailed(confirmed);
        setMessage(confirmed ? `${savedMessage} The workspace list could not be refreshed. Use Refresh saved records to check it.` : "We could not confirm the save. Your draft is kept. Retrying the same draft reuses its request key to avoid duplicates.");
      }
    } finally {
      if (current()) { inFlight.current = false; onBusyChange(false); }
    }
  }

  return { message, failed, refreshFailed, expired, save: (request: PendingSave) => perform(request), refresh: () => perform() };
}
