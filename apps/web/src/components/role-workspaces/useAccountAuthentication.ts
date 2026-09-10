"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { accountSessionHeaders, storeAccountSession, subscribeAccountSession, type AccountAuthentication } from "@/lib/api";

const subscribeHydration = () => () => {};

// One credential submission per mounted owner. Neither unmount nor a newer
// account session may be undone by a late authentication response.
export default function useAccountAuthentication() {
  const ready = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function run<T extends AccountAuthentication>(action: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    if (pending.current) return null;
    const controller = new AbortController();
    pending.current = controller;
    let unsubscribe = () => {};
    try {
      const owner = accountSessionHeaders().Authorization;
      unsubscribe = subscribeAccountSession(() => {
        if (owner !== accountSessionHeaders().Authorization) controller.abort();
      });
      const result = await action(controller.signal);
      if (controller.signal.aborted || owner !== accountSessionHeaders().Authorization) return null;
      // Stop observing the old owner before publishing our own verified login.
      unsubscribe();
      storeAccountSession(result.session);
      return result;
    } catch (error) {
      if (controller.signal.aborted) return null;
      throw error;
    } finally {
      unsubscribe();
      if (pending.current === controller) pending.current = null;
    }
  }
  return { run, ready, busy: () => Boolean(pending.current) };
}
