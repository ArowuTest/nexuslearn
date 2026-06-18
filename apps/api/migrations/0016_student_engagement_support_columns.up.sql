ALTER TABLE student_engagement_profiles
  ADD COLUMN IF NOT EXISTS declared_support_needs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_approaches text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sensory_load text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS attention_support text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS communication_support text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS processing_support text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS confidence_support text NOT NULL DEFAULT 'balanced';
