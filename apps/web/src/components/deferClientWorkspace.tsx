"use client";

import { lazy, Suspense, useSyncExternalStore, type ComponentType, type ReactNode } from "react";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

// Declare at module scope, like React.lazy. Admin-only workspaces must not
// import or render on the server, even if a future caller passes initial data.
export function deferClientWorkspace<P extends object>(load: () => Promise<{ default: ComponentType<P> }>, fallback: ReactNode) {
  const Workspace = lazy(load);
  return function DeferredWorkspace(props: P) {
    const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
    return <Suspense fallback={fallback}>{ready ? <Workspace {...props} /> : fallback}</Suspense>;
  };
}
