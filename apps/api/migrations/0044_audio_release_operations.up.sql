CREATE TABLE IF NOT EXISTS audio_manifests (
  release_id text PRIMARY KEY CHECK (release_id ~ '^narration-release-v2-[0-9a-f]{24}$'),
  release_sha256 text NOT NULL UNIQUE CHECK (release_sha256 ~ '^[0-9a-f]{64}$'),
  catalogue_id text NOT NULL,
  catalogue_sha256 text NOT NULL CHECK (catalogue_sha256 ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL,
  status text NOT NULL,
  expected_assets integer NOT NULL CHECK (expected_assets >= 0),
  produced_assets integer NOT NULL CHECK (produced_assets >= 0 AND produced_assets <= expected_assets),
  reference_ids integer NOT NULL CHECK (reference_ids >= 0),
  specialist_required integer NOT NULL CHECK (specialist_required >= 0),
  unresolved integer NOT NULL CHECK (unresolved >= 0),
  imported_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audio_manifest_assets (
  release_id text NOT NULL REFERENCES audio_manifests(release_id) ON DELETE RESTRICT,
  asset_id text NOT NULL CHECK (asset_id ~ '^narration-v1-[0-9a-f]{24}$'),
  transcript text NOT NULL,
  text_sha256 text NOT NULL CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  audio_sha256 text NOT NULL CHECK (audio_sha256 ~ '^[0-9a-f]{64}$'),
  production_identity_sha256 text NOT NULL CHECK (production_identity_sha256 ~ '^[0-9a-f]{64}$'),
  production_profile_sha256 text NOT NULL CHECK (production_profile_sha256 ~ '^[0-9a-f]{64}$'),
  pack_id text NOT NULL,
  year_group integer NOT NULL CHECK (year_group BETWEEN 0 AND 7),
  kind text NOT NULL,
  public_file text NOT NULL,
  provider text NOT NULL,
  voice_id text NOT NULL,
  model_id text NOT NULL,
  output_format text NOT NULL,
  voice_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_status text NOT NULL,
  reuse_count integer NOT NULL CHECK (reuse_count >= 0),
  byte_count bigint NOT NULL CHECK (byte_count > 0),
  technical_pass boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, asset_id)
);

CREATE TABLE IF NOT EXISTS audio_manifest_references (
  release_id text NOT NULL REFERENCES audio_manifests(release_id) ON DELETE RESTRICT,
  reference_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('production_required', 'specialist_required', 'unresolved')),
  production_asset_id text,
  text_sha256 text NOT NULL CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  production_identity_sha256 text,
  production_profile_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (release_id, reference_id),
  CHECK (production_asset_id IS NULL OR production_asset_id ~ '^narration-v1-[0-9a-f]{24}$'),
  CHECK (production_identity_sha256 IS NULL OR production_identity_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (production_profile_sha256 IS NULL OR production_profile_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS audio_rerecord_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id text NOT NULL,
  asset_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('pronunciation', 'naturalness', 'clarity', 'age_suitability', 'pace', 'technical', 'transcript_change', 'other')),
  notes text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'scheduled', 'completed', 'cancelled')),
  requested_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (release_id, asset_id)
    REFERENCES audio_manifest_assets(release_id, asset_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS audio_manifest_assets_review_idx
  ON audio_manifest_assets(release_id, production_status, technical_pass, year_group, asset_id);

CREATE INDEX IF NOT EXISTS audio_manifest_references_asset_idx
  ON audio_manifest_references(release_id, production_asset_id, reference_id);

CREATE INDEX IF NOT EXISTS audio_rerecord_requests_asset_created_idx
  ON audio_rerecord_requests(release_id, asset_id, created_at DESC, id DESC);
