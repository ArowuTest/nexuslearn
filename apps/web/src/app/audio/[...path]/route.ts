import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import manifest from "../../../../public/content/narration-manifest.json";
import { narrationSignatureValid } from "@/lib/narration-access.mjs";
import { narrationByFile, narrationPathApproved } from "@/lib/narration-policy.mjs";
import { canonicalNarrationPath, privateAudioFile } from "@/lib/private-audio.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManifestItem = { id?: string; file?: string; pack_id?: string; technical_pass?: boolean; production_status?: string };

const items = ((manifest as { items?: ManifestItem[] }).items ?? []) as ManifestItem[];
const files = narrationByFile(items);
const fileById = new Map<string, string>();
for (const item of items) {
  if (item.id && item.file) fileById.set(item.id, item.file);
}

let approvalCache: { at: number; ids: Set<string> } = { at: 0, ids: new Set() };

function apiBase() {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
}

async function approvedNarrationIds() {
  const now = Date.now();
  if (now - approvalCache.at < 60_000) return approvalCache.ids;
  const api = apiBase();
  approvalCache = { at: now, ids: approvalCache.ids };
  if (!api) return approvalCache.ids;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 400);
  try {
    const response = await fetch(`${api}/v1/runtime/narration-approvals`, { cache: "no-store", signal: controller.signal });
    if (response.ok) {
      const body = await response.json() as { narration_ids?: string[] };
      approvalCache = { at: now, ids: new Set(body.narration_ids ?? []) };
    }
  } catch {
    // Keep the last known approvals when the API is briefly unreachable.
  } finally {
    clearTimeout(timer);
  }
  return approvalCache.ids;
}

function audioResponse(absolute: string) {
  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function streamKnownFile(logical: string) {
  const absolute = privateAudioFile(process.cwd(), logical);
  if (!absolute) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    await access(absolute);
  } catch {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return audioResponse(absolute);
}

async function reviewerAllowed(authorization: string) {
  if (!authorization.toLowerCase().startsWith("bearer ") || authorization.trim().length < 12) return 401;
  const api = apiBase();
  if (!api) return 503;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const allowed = await fetch(`${api}/v1/auth/review-access`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!allowed.ok) return 401;
    return 200;
  } catch {
    return 503;
  } finally {
    clearTimeout(timer);
  }
}

async function reviewListen(request: NextRequest) {
  const status = await reviewerAllowed(request.headers.get("authorization") || "");
  if (status === 401) return new NextResponse("A reviewer session is required to listen before approval.", { status: 401 });
  if (status === 503) return new NextResponse("The learning API could not confirm this session.", { status: 503 });
  const id = request.nextUrl.searchParams.get("id") || "";
  const requested = request.nextUrl.searchParams.get("file") || "";
  const logical = canonicalNarrationPath(fileById.get(id) || requested);
  if (!logical || !files.has(logical)) return new NextResponse("Not found", { status: 404 });
  return streamKnownFile(logical);
}

async function childAudio(request: NextRequest, logical: string) {
  if (!canonicalNarrationPath(logical) || !files.has(logical)) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const expiresAt = request.nextUrl.searchParams.get("exp") || "";
  const signature = request.nextUrl.searchParams.get("nl") || "";
  const approved = narrationPathApproved(logical, files, await approvedNarrationIds())
    || narrationSignatureValid(logical, expiresAt, signature);
  if (!approved) {
    return new NextResponse("This recording is not approved for children yet.", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  return streamKnownFile(logical);
}

async function reviewDecision(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "A reviewer session is required." }, { status: 401 });
  }
  const api = apiBase();
  if (!api) return NextResponse.json({ error: "The learning API is not configured." }, { status: 503 });
  const body = await request.text();
  if (body.length > 256_000) return NextResponse.json({ error: "the review decision is too large" }, { status: 413 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${api}/v1/admin/content/pack-approvals`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "The learning API could not save this decision." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path ?? [];
  if (parts.some((part) => {
    if (part === "" || part === "." || part === ".." || part.includes("%")) return true;
    try {
      return part !== decodeURIComponent(part);
    } catch {
      return true;
    }
  })) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (parts.length === 1 && parts[0] === "review-listen") return reviewListen(request);
  const logical = `/audio/${parts.join("/")}`;
  return childAudio(request, logical);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path ?? [];
  if (parts.length === 1 && parts[0] === "review-decision") return reviewDecision(request);
  return new NextResponse("Not found", { status: 404 });
}
