DROP INDEX IF EXISTS audio_manifests_release_gate_idx;

ALTER TABLE audio_manifests
  DROP CONSTRAINT IF EXISTS audio_manifests_licence_id_check;

ALTER TABLE audio_manifests
  DROP COLUMN IF EXISTS licence_id;
