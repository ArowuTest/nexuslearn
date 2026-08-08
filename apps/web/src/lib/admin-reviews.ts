import { accountSessionHeaders } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL;
const REVIEW_ROLES = ["platform_admin", "content_editor", "content_reviewer"];

export type AIReviewLane = "ai_curriculum_lead" | "ai_send_lead";
export type AIReviewStatus = "approved" | "approved_with_observation" | "revision_required" | "escalation_required";
export type AIReviewRiskTier = "tier_1" | "tier_2" | "tier_3";

export type AIReviewFinding = {
  id?: string;
  evidence_id?: string;
  criterion_id: string;
  severity: "observation" | "blocking" | "escalation";
  finding_code: string;
  affected_fields: string[];
  rationale: string;
  required_revisions: string[];
  created_at?: string;
};

export type AIReviewEvidence = {
  id?: string;
  content_id: string;
  content_type: "pack" | "variant" | "variant_family";
  content_revision: string;
  content_hash: string;
  pack_id: string;
  year_group: number;
  subject: string;
  lane_id: AIReviewLane;
  status: AIReviewStatus;
  risk_tier: AIReviewRiskTier;
  rubric_revision: string;
  source_set_revision: string;
  reviewer_implementation: string;
  model_identifier: string;
  confidence: number;
  criterion_results: Record<string, { result?: string; evidence?: string } | string | number | boolean | null>;
  source_ids: string[];
  reviewed_variant_ids: string[];
  evidence_notes: string;
  supersedes_id?: string;
  findings: AIReviewFinding[];
  created_at?: string;
  stale: boolean;
};

export type AIReviewPage = {
  items: AIReviewEvidence[];
  next_cursor?: string;
};

export type AIReviewSummary = {
  packs: number;
  variants: number;
  current_ai_curriculum_lead: number;
  current_ai_send_lead: number;
  stale: number;
  revision_required: number;
  escalation_required: number;
  blocking_findings: number;
  escalation_findings: number;
  controlled_pilot_allowed: boolean;
};

export type AIReviewQuery = {
  lane_id?: string;
  status?: string;
  risk_tier?: string;
  year_group?: string;
  subject?: string;
  pack_id?: string;
  cursor?: string;
  limit?: number;
};

async function reviewFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  const authorization = accountSessionHeaders(REVIEW_ROLES);
  if (!authorization.Authorization) throw new Error("A named curriculum-review account session is required.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", authorization.Authorization);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "AI review request failed.");
  return body as T;
}

export async function getAIReviews(query: AIReviewQuery = {}): Promise<AIReviewPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return reviewFetch<AIReviewPage>(`/v1/admin/ai-reviews${params.size ? `?${params.toString()}` : ""}`);
}

export async function getAIReviewSummary(): Promise<AIReviewSummary> {
  return reviewFetch<AIReviewSummary>("/v1/admin/ai-reviews/summary");
}

export async function saveAIReview(input: AIReviewEvidence): Promise<AIReviewEvidence> {
  const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ai-review-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { id: _id, created_at: _createdAt, stale: _stale, ...payload } = input;
  return reviewFetch<AIReviewEvidence>("/v1/admin/ai-reviews", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}
