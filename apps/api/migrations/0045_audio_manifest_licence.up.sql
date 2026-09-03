ALTER TABLE audio_manifests
  ADD COLUMN IF NOT EXISTS licence_id text;

ALTER TABLE audio_manifests
  DROP CONSTRAINT IF EXISTS audio_manifests_licence_id_check;

ALTER TABLE audio_manifests
  ADD CONSTRAINT audio_manifests_licence_id_check
  CHECK (licence_id IS NULL OR licence_id = 'provider_terms');

CREATE INDEX IF NOT EXISTS audio_manifests_release_gate_idx
  ON audio_manifests(release_id, catalogue_id, status, licence_id);
