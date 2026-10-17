// Catalogue clips live under /audio/. A child may hear one only when the
// released narration index names that exact file. Test fixtures and reviewer
// data URLs are not catalogue files.

export function isCatalogueAudioPath(value) {
  return typeof value === "string" && value.trim().startsWith("/audio/");
}

export function isBlockedCatalogueAudio(value, approvedFiles) {
  if (!isCatalogueAudioPath(value)) return false;
  return !approvedFiles?.has(value.trim());
}
