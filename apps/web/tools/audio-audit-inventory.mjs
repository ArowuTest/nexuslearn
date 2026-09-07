// Check before constructing lookup Maps: duplicate IDs must remain visible.
export function reconcileAudioInventory(privateItems, publicItems, diskPaths) {
  const issues = [];
  if (!privateItems.length || !publicItems.length || !diskPaths.length) issues.push({ code: "empty_catalogue" });
  function index(items, kind) {
    const ids = new Map(), files = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.file !== "string" || !/^\/audio\/[a-zA-Z0-9_./-]+\.(mp3|wav|ogg|m4a)$/i.test(item.file) || item.file.split("/").some(part => part === "." || part === "..")) {
        issues.push({ code: `invalid_${kind}_entry`, id: item?.id ?? null });
        continue;
      }
      if (ids.has(item.id)) issues.push({ code: `duplicate_${kind}_id`, id: item.id });
      if (files.has(item.file)) issues.push({ code: `duplicate_${kind}_file`, file: item.file });
      ids.set(item.id, item);
      files.add(item.file);
    }
    return { ids, files };
  }
  const privateIndex = index(privateItems, "private"), publicIndex = index(publicItems, "public");
  const disk = new Set(diskPaths);
  for (const item of privateIndex.ids.values()) {
    if (!disk.has(item.file)) issues.push({ code: "missing_file", id: item.id, file: item.file });
    if (publicIndex.ids.get(item.id)?.file !== item.file) issues.push({ code: "public_manifest_mismatch", id: item.id });
  }
  for (const item of publicIndex.ids.values()) {
    if (!privateIndex.ids.has(item.id)) issues.push({ code: "public_manifest_orphan", id: item.id });
  }
  for (const file of disk) if (!privateIndex.files.has(file)) issues.push({ code: "orphan_file", file });
  return issues;
}

export function fatalAudioAudit(inventoryIssues, rows) {
  const fatal = new Set(["decode_failed", "silent_audio", "invalid_pcm_samples", "audio_hash_mismatch", "script_hash_mismatch", "frame_inspection_failed"]);
  return inventoryIssues.length > 0 || rows.some(row => row.flags.some(flag => fatal.has(flag)));
}
