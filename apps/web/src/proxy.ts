import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import manifest from "../public/content/narration-manifest.json";
import { narrationSignatureValid } from "./lib/narration-access.mjs";
import { narrationByFile, narrationPathApproved, releasedNarrationPaths } from "./lib/narration-policy.mjs";
import { safePublicAudioPath } from "./lib/review-audio-path.mjs";

const manifestItems = (manifest as { items?: unknown[] }).items;
const releasedPaths = releasedNarrationPaths(manifestItems);
const files = narrationByFile(manifestItems);
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

async function reviewAudio(request: NextRequest) {
  if (request.method !== "GET") return new NextResponse("Not found", { status: 404 });
  const file = request.nextUrl.searchParams.get("file") || "";
  const absolute = safePublicAudioPath(process.cwd(), file);
  if (!absolute) return new NextResponse("Not found", { status: 404 });
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ") || authorization.trim().length < 12) {
    return new NextResponse("A parent or teacher session is required to listen before approval.", { status: 401 });
  }
  const api = apiBase();
  if (!api) return new NextResponse("The learning API is not configured.", { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const allowed = await fetch(`${api}/v1/auth/review-access`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!allowed.ok) return new NextResponse("A parent or teacher session is required to listen before approval.", { status: 401 });
  } catch {
    return new NextResponse("The learning API could not confirm this session.", { status: 503 });
  } finally {
    clearTimeout(timer);
  }
  try {
    await access(absolute);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function packApproval(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "A parent or teacher session is required." }, { status: 401 });
  }
  const api = apiBase();
  if (!api) return NextResponse.json({ error: "The learning API is not configured." }, { status: 503 });
  const body = await request.text();
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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/review") return NextResponse.rewrite(new URL("/review/index.html", request.url));
  if (pathname === "/audio/review-listen") return reviewAudio(request);
  if (pathname === "/audio/review-decision") return packApproval(request);
  if (!pathname.startsWith("/audio/")) return NextResponse.next();
  if (releasedPaths.has(pathname)) return NextResponse.next();
  if (narrationPathApproved(pathname, files, await approvedNarrationIds())) return NextResponse.next();
  const expiresAt = request.nextUrl.searchParams.get("exp") || "";
  const signature = request.nextUrl.searchParams.get("nl") || "";
  if (narrationSignatureValid(pathname, expiresAt, signature)) return NextResponse.next();
  return new NextResponse("This recording is not approved for children yet.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export const config = { matcher: ["/audio/:path*", "/review"] };
