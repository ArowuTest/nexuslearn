import path from "node:path";

// Logical catalogue paths stay /audio/narration/...mp3. The bytes live under
// private/ (or NARRATION_AUDIO_ROOT) and are never placed in public/.
const CANONICAL = /^\/audio\/narration\/[a-z0-9][a-z0-9/_-]*\.mp3$/;

export function canonicalNarrationPath(input) {
  if (typeof input !== "string" || input.length === 0 || input.length > 512) return "";
  if (input !== input.trim() || input.includes("%") || input.includes("\\") || input.includes("\0") || input.includes("..") || input.includes("//") || input.includes("?")) return "";
  if (input !== input.toLowerCase()) return "";
  if (!CANONICAL.test(input)) return "";
  return input;
}

export function narrationAudioRoot(cwd = process.cwd()) {
  const configured = String(process.env.NARRATION_AUDIO_ROOT || "").trim();
  if (configured) return path.resolve(configured);
  return path.resolve(cwd, "private");
}

export function privateAudioFile(cwd, file) {
  const canonical = canonicalNarrationPath(file);
  if (!canonical) return "";
  const root = narrationAudioRoot(cwd);
  const absolute = path.resolve(root, canonical.replace(/^\/+/, ""));
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return "";
  return absolute;
}
