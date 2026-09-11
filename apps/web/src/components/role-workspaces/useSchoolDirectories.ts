"use client";

import { useEffect, useRef, useState } from "react";

export type DirectoryKind = "classes" | "groups" | "students";
export type DirectoryStudent = { external_ref: string; display_name: string; year_group: number };
export type DirectoryClass = { id: string; name: string; year_group: number; student_count: number };
export type DirectoryGroup = { id: string; class_id: string; name: string; purpose: string; student_count: number };
export type DirectoryItem = DirectoryStudent | DirectoryClass | DirectoryGroup;
export type DirectoryInfo = { version: 1; counts: Record<DirectoryKind, number>; classes_next_cursor?: string; groups_next_cursor?: string; students_next_cursor?: string };
export type DirectoryView = { items: DirectoryItem[]; next: string; cursors: string[]; index: number; search: string; draft: string; status: "ready" | "loading" | "error"; error: string };
const kinds: DirectoryKind[] = ["classes", "groups", "students"];
const emptyView = (): DirectoryView => ({ items: [], next: "", cursors: [""], index: 0, search: "", draft: "", status: "ready", error: "" });
const emptyViews = () => ({ classes: emptyView(), groups: emptyView(), students: emptyView() });
const failure = () => new Error("The school directory response could not be verified.");
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure();
  return value as Record<string, unknown>;
};
function text(value: unknown, maximum = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw failure();
  return value;
}
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw failure();
  return value as number;
}
export function classYearLabel(value: number): string { return value === 0 ? "Year not set" : `Year ${value}`; }
function year(value: unknown, unset = false): number {
  const result = count(value);
  if (result < (unset ? 0 : 1) || result > 7) throw failure();
  return result;
}
function cursor(value: unknown): string {
  if (value == null || value === "") return "";
  return text(value, 4096);
}
export function directoryItems(kind: DirectoryKind, value: unknown): DirectoryItem[] {
  if (!Array.isArray(value) || value.length > 20) throw failure();
  const ids = new Set<string>();
  return value.map(raw => {
    const item = record(raw);
    const id = text(kind === "students" ? item.external_ref : item.id, 200);
    if (ids.has(id)) throw failure();
    ids.add(id);
    if (kind === "students") return { external_ref: id, display_name: text(item.display_name), year_group: year(item.year_group) };
    const common = { id, name: text(item.name), student_count: count(item.student_count) };
    return kind === "classes" ? { ...common, year_group: year(item.year_group, true) }
      : { ...common, class_id: text(item.class_id, 200), purpose: text(item.purpose, 100) };
  });
}
export function schoolDirectoryPage(kind: DirectoryKind, value: unknown, urn: string, seen: string[] = []) {
  const page = record(value);
  if (page.school_urn !== urn || page.kind !== kind) throw failure();
  const next = cursor(page.next_cursor);
  if (next && seen.includes(next)) throw failure();
  return { items: directoryItems(kind, page.items), next };
}
export function schoolDirectoryOverview(value: unknown) {
  const data = record(value);
  if (data.directory === undefined) return null; // Legacy server during rolling deployment.
  const info = record(data.directory);
  if (info.version !== 1) throw failure();
  const urn = text(record(data.school).urn, 200);
  if (record(data.current_user).school_urn !== urn) throw failure();
  const totals = record(info.counts);
  const counts = { classes: count(totals.classes), groups: count(totals.groups), students: count(totals.students) };
  const views = emptyViews();
  for (const kind of kinds) views[kind] = { ...emptyView(), items: directoryItems(kind, data[kind]), next: cursor(info[`${kind}_next_cursor`]) };
  return { urn, counts, views };
}

export default function useSchoolDirectories(request: (path: string, options?: RequestInit) => Promise<unknown>, denied: () => void) {
  const [enabled, setEnabled] = useState(false);
  const [views, setViews] = useState(emptyViews);
  const [counts, setCounts] = useState({ classes: 0, groups: 0, students: 0 });
  const lifetime = useRef({ version: 0, urn: "", mounted: true, controllers: {} as Partial<Record<DirectoryKind, AbortController>> });
  function invalidate() {
    lifetime.current.version++;
    Object.values(lifetime.current.controllers).forEach(controller => controller.abort());
    lifetime.current.controllers = {};
  }
  useEffect(() => {
    const active = lifetime.current;
    active.mounted = true;
    return () => { active.mounted = false; active.version++; Object.values(active.controllers).forEach(controller => controller.abort()); active.controllers = {}; };
  }, []);
  function reset() {
    invalidate(); lifetime.current.urn = "";
    setEnabled(false); setViews(emptyViews()); setCounts({ classes: 0, groups: 0, students: 0 });
  }
  function initialise(value: unknown) {
    const parsed = schoolDirectoryOverview(value);
    if (!parsed) { reset(); return; }
    invalidate(); lifetime.current.urn = parsed.urn;
    setEnabled(true); setViews(parsed.views); setCounts(parsed.counts);
  }
  async function load(kind: DirectoryKind, search: string, cursors: string[], index: number) {
    const scope = lifetime.current;
    if (!scope.mounted || !scope.urn) return;
    scope.controllers[kind]?.abort();
    const controller = new AbortController();
    scope.controllers[kind] = controller;
    const version = scope.version;
    const urn = scope.urn;
    const current = () => scope.mounted && version === scope.version && scope.controllers[kind] === controller && !controller.signal.aborted;
    const cleanSearch = search.trim();
    setViews(values => ({ ...values, [kind]: { ...values[kind], items: [], next: "", search: cleanSearch, cursors, index, status: "loading", error: "" } }));
    try {
      const params = new URLSearchParams({ kind, limit: "20" });
      if (cleanSearch) params.set("search", cleanSearch);
      if (cursors[index]) params.set("cursor", cursors[index]);
      const data = await request(`/v1/school/directory?${params}`, { signal: controller.signal });
      if (!current()) return;
      const page = schoolDirectoryPage(kind, data, urn, cursors);
      setViews(values => ({ ...values, [kind]: { ...values[kind], ...page, status: "ready", error: "" } }));
    } catch (error) {
      if (!current()) return;
      if ([401, 403].includes((error as { status?: number }).status ?? 0)) { reset(); denied(); return; }
      setViews(values => ({ ...values, [kind]: { ...values[kind], status: "error", error: error instanceof Error ? error.message : "Could not load the school directory." } }));
    }
  }
  function edit(kind: DirectoryKind, draft: string) { setViews(values => ({ ...values, [kind]: { ...values[kind], draft } })); }
  function navigate(kind: DirectoryKind, action: "search" | "clear" | "next" | "previous" | "retry") {
    const view = views[kind];
    if (action === "search" || action === "clear") {
      if (action === "clear") edit(kind, "");
      return load(kind, action === "clear" ? "" : view.draft, [""], 0);
    }
    if (action === "next" && view.next) return load(kind, view.search, [...view.cursors, view.next], view.index + 1);
    if (action === "previous" && view.index > 0) return load(kind, view.search, view.cursors.slice(0, view.index), view.index - 1);
    if (action === "retry") return load(kind, view.search, view.cursors, view.index);
  }
  return { enabled, views, counts, reset, initialise, edit, navigate };
}
