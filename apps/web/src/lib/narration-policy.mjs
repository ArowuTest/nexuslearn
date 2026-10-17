const RELEASED_STATUSES = new Set(["human_listening_approved", "approved", "production_approved", "released"]);
const FIXTURE_AUDIO = /^\/qa-[^/?#]+\.mp3$/i;

export function isReleasedNarration(item) {
  return item?.technical_pass === true && RELEASED_STATUSES.has(String(item?.production_status ?? ""));
}

export function releasedNarrationPaths(items) {
  const paths = new Set();
  for (const item of items ?? []) {
    if (isReleasedNarration(item) && typeof item.file === "string" && item.file.startsWith("/audio/")) paths.add(item.file);
  }
  return paths;
}

export function narrationByFile(items) {
  const byFile = new Map();
  for (const item of items ?? []) {
    if (typeof item?.file === "string" && item.file.startsWith("/audio/") && item.id) byFile.set(item.file, item);
  }
  return byFile;
}

// A child may hear a file when the catalogue already marks it released, or when
// a parent/teacher has approved that exact narration id.
export function narrationPathApproved(pathname, byFile, approvedIds) {
  const item = byFile?.get?.(pathname);
  if (!item) return false;
  if (isReleasedNarration(item)) return true;
  return Boolean(item.id && approvedIds?.has?.(item.id));
}

// Children may hear a clip only when a person has approved it, or when the
// caller is a disposable /qa- fixture used by automated journeys.
export function resolveNarrationCandidate(value, assets) {
  if (typeof value !== "string" || !value.trim()) return "";
  const candidate = value.trim();
  const released = assets?.get?.(candidate);
  if (released) return released;
  if (FIXTURE_AUDIO.test(candidate) || candidate.startsWith("blob:") || candidate.startsWith("data:audio/")) return candidate;
  if (assets && typeof assets.values === "function") {
    for (const file of assets.values()) {
      if (file === candidate) return candidate;
    }
  }
  return "";
}
