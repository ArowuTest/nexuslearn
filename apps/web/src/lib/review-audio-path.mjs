import path from "node:path";

export function safePublicAudioPath(cwd, file) {
  if (typeof file !== "string" || !file.startsWith("/audio/narration/") || file.includes("..") || file.includes("\\") || file.includes("\0")) {
    return "";
  }
  const root = path.resolve(cwd, "public");
  const absolute = path.resolve(root, file.replace(/^\/+/, ""));
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return "";
  return absolute;
}
