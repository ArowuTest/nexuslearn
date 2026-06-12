ALTER TABLE student_engagement_profiles
  DROP COLUMN IF EXISTS confidence_support,
  DROP COLUMN IF EXISTS processing_support,
  DROP COLUMN IF EXISTS communication_support,
  DROP COLUMN IF EXISTS attention_support,
  DROP COLUMN IF EXISTS sensory_load,
  DROP COLUMN IF EXISTS learning_approaches,
  DROP COLUMN IF EXISTS declared_support_needs;

