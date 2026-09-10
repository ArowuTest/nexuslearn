"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { accountSessionHeaders, accountSessionRole, subscribeAccountSession } from "@/lib/api";

function owner() {
  const token = accountSessionHeaders().Authorization;
  return token ? `${token}:${accountSessionRole()}` : "";
}

// A workspace owns all its private drafts and reads, not just the visible card.
// Initial sign-in is still committed solely by useAccountAuthentication.
export default function useAccountWorkspace(reset: () => void) {
  const lifetime = useRef({ version: 0, mounted: true, controllers: new Set<AbortController>() });
  const onChanged = useEffectEvent(reset);

  function invalidate() {
    lifetime.current.version++;
    lifetime.current.controllers.forEach(controller => controller.abort());
    lifetime.current.controllers.clear();
  }

  useEffect(() => {
    let previous = owner();
    const active = lifetime.current;
    active.mounted = true;
    const unsubscribe = subscribeAccountSession(() => {
      const current = owner();
      if (current === previous) return;
      const hadOwner = Boolean(previous);
      previous = current;
      // Do not erase a first sign-in's submitted form while its owner hook is
      // publishing the verified session. Replacements and expiry clear all UI.
      if (hadOwner) { invalidate(); onChanged(); }
    });
    return () => {
      unsubscribe();
      active.mounted = false;
      active.version++;
      active.controllers.forEach(controller => controller.abort());
      active.controllers.clear();
    };
  }, []);

  function capture() {
    const revision = lifetime.current.version;
    const identity = owner();
    return () => lifetime.current.mounted && revision === lifetime.current.version && identity === owner();
  }

  async function run<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const current = capture();
    if (!current()) throw new Error("The account request was cancelled.");
    const controller = new AbortController();
    lifetime.current.controllers.add(controller);
    try {
      const result = await action(controller.signal);
      if (!current() || controller.signal.aborted) throw new Error("The account request was cancelled.");
      return result;
    } catch (error) {
      if (!current() || controller.signal.aborted) throw new Error("The account request was cancelled.");
      throw error;
    } finally {
      lifetime.current.controllers.delete(controller);
    }
  }

  return { capture, invalidate, run };
}
