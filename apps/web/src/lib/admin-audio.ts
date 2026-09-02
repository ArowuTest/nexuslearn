export type AdminRequest = (path: string, options?: RequestInit) => Promise<unknown>;

export type AudioDecisionStatus = "awaiting" | "approved" | "rejected" | "stale" | "all";

export type AudioQueueFilters = {
  status: AudioDecisionStatus;
  subject: string;
  year: string;
  kind: string;
  search: string;
};

export type NarrationReview = {
  id: string;
  asset_id: string;
  text_sha256: string;
  audio_sha256: string;
  production_profile_sha256?: string;
  decision: "approved" | "rejected";
  reviewer_name: string;
  criteria: Record<string, boolean>;
  rejection_reasons?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  stale?: boolean;
};

export type NarrationQueueItem = {
  rank: number;
  asset_id: string;
  pack_id: string;
  year: number;
  subject: string;
  kind: string;
  source_id: string;
  text_preview: string;
  file: string;
  text_sha256: string;
  audio_sha256: string;
  production_identity_sha256?: string;
  production_profile_sha256?: string;
  reuse_count?: number;
  reference_count?: number;
  voice_name?: string;
  model_id?: string;
  status: Exclude<AudioDecisionStatus, "all">;
  review?: NarrationReview;
  rationale: string[];
};

type AudioCounts = Record<Exclude<AudioDecisionStatus, "all">, number>;

export type NarrationQueuePage = {
  release_id?: string;
  catalogue_id?: string;
  items: NarrationQueueItem[];
  total: number;
  counts: AudioCounts;
  years?: Array<{ year: number; counts: AudioCounts; reviewed: number; pending: number }>;
  limit: number;
  offset: number;
  next_offset: number | null;
  served_by: "api";
  provider?: string;
  voice_name?: string;
  model_id?: string;
};

export type NarrationReadinessReport = {
  status: "ready" | "gaps_present";
  totals: {
    expected_assets: number;
    technical_pass: number;
    listening_approved: number;
    missing: number;
    unreviewed: number;
    variant_references: number;
    variant_manifest_items: number;
    unresolved_variant_references: number;
    nonconforming_variant_references: number;
  };
  years: Array<{
    year: number;
    expected_assets: number;
    technical_pass: number;
    listening_approved: number;
    missing: number;
    unreviewed: number;
    variant_references: number;
    unresolved_variant_references: number;
  }>;
};

export const DEFAULT_AUDIO_FILTERS: AudioQueueFilters = {
  status: "awaiting",
  subject: "",
  year: "",
  kind: "",
  search: "",
};

const decisionStatuses = new Set<AudioDecisionStatus>(["awaiting", "approved", "rejected", "stale", "all"]);

export function audioFiltersFromSearch(search: string): AudioQueueFilters {
  const query = new URLSearchParams(search);
  const status = query.get("audio_status") as AudioDecisionStatus | null;
  return {
    status: status && decisionStatuses.has(status) ? status : DEFAULT_AUDIO_FILTERS.status,
    subject: query.get("audio_subject") ?? "",
    year: query.get("audio_year") ?? "",
    kind: query.get("audio_kind") ?? "",
    search: query.get("audio_search") ?? "",
  };
}

export function audioQueueQuery(filters: AudioQueueFilters, offset: number, limit = 20) {
  const query = new URLSearchParams({ status: filters.status, limit: String(limit), offset: String(offset) });
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.year) query.set("year", filters.year);
  if (filters.kind) query.set("kind", filters.kind);
  if (filters.search.trim()) query.set("search", filters.search.trim());
  return query;
}

export function syncAudioFiltersToURL(filters: AudioQueueFilters) {
  const url = new URL(window.location.href);
  const fields: Array<[keyof AudioQueueFilters, string]> = [
    ["status", "audio_status"],
    ["subject", "audio_subject"],
    ["year", "audio_year"],
    ["kind", "audio_kind"],
    ["search", "audio_search"],
  ];
  for (const [field, queryName] of fields) {
    const value = filters[field].trim();
    if (value && !(field === "status" && value === DEFAULT_AUDIO_FILTERS.status)) url.searchParams.set(queryName, value);
    else url.searchParams.delete(queryName);
  }
  window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

export async function loadAudioQueue(request: AdminRequest, filters: AudioQueueFilters, offset = 0) {
  const data = await request(`/v1/admin/content/narration-queue?${audioQueueQuery(filters, offset)}`) as NarrationQueuePage;
  if (!Array.isArray(data.items) || typeof data.total !== "number") {
    throw new Error("The audio listening queue returned an invalid response.");
  }
  return {
    ...data,
    counts: {
      awaiting: Number(data.counts?.awaiting ?? 0),
      approved: Number(data.counts?.approved ?? 0),
      rejected: Number(data.counts?.rejected ?? 0),
      stale: Number(data.counts?.stale ?? 0),
    },
  };
}

async function idempotencyKey(scope: string, payload: unknown) {
  const encoded = new TextEncoder().encode(`${scope}:${JSON.stringify(payload)}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function saveAudioReview(
  request: AdminRequest,
  item: NarrationQueueItem,
  input: { decision: "approved" | "rejected"; reviewerName: string; criteria: Record<string, boolean>; rejectionReason?: string; notes: string },
) {
  const payload = {
    asset_id: item.asset_id,
    text_sha256: item.text_sha256,
    audio_sha256: item.audio_sha256,
    production_profile_sha256: item.production_profile_sha256 ?? "",
    decision: input.decision,
    reviewer_name: input.reviewerName.trim(),
    criteria: input.criteria,
    rejection_reasons: input.decision === "rejected" && input.rejectionReason ? [input.rejectionReason] : [],
    notes: input.notes.trim(),
  };
  return request("/v1/admin/content/narration-reviews", {
    method: "POST",
    headers: { "Idempotency-Key": await idempotencyKey(`audio-review:${item.asset_id}`, payload) },
    body: JSON.stringify(payload),
  });
}

export async function requestAudioRerecord(
  request: AdminRequest,
  releaseID: string,
  item: NarrationQueueItem,
  reason: string,
  notes: string,
) {
  const payload = { release_id: releaseID, reason, notes: notes.trim() };
  return request(`/v1/admin/audio/assets/${encodeURIComponent(item.asset_id)}/rerecord-request`, {
    method: "POST",
    headers: { "Idempotency-Key": await idempotencyKey(`audio-rerecord:${releaseID}:${item.asset_id}`, payload) },
    body: JSON.stringify(payload),
  });
}
