CREATE TABLE IF NOT EXISTS student_engagement_profiles (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  declared_support_needs text[] NOT NULL DEFAULT '{}',
  learning_approaches text[] NOT NULL DEFAULT '{}',
  celebration_intensity text NOT NULL DEFAULT 'balanced' CHECK (celebration_intensity IN ('quiet', 'balanced', 'big')),
  audio_support boolean NOT NULL DEFAULT false,
  reading_support boolean NOT NULL DEFAULT false,
  session_length text NOT NULL DEFAULT 'standard' CHECK (session_length IN ('short', 'standard', 'extended')),
  sensory_load text NOT NULL DEFAULT 'balanced' CHECK (sensory_load IN ('low', 'balanced', 'high')),
  attention_support text NOT NULL DEFAULT 'standard' CHECK (attention_support IN ('standard', 'chunked', 'high_structure')),
  communication_support text NOT NULL DEFAULT 'standard' CHECK (communication_support IN ('standard', 'visual', 'audio_visual')),
  processing_support text NOT NULL DEFAULT 'standard' CHECK (processing_support IN ('standard', 'extra_time', 'step_by_step')),
  confidence_support text NOT NULL DEFAULT 'balanced' CHECK (confidence_support IN ('gentle', 'balanced', 'challenge')),
  companion_style text NOT NULL DEFAULT 'friendly' CHECK (companion_style IN ('friendly', 'funny', 'calm', 'coach')),
  reward_style text NOT NULL DEFAULT 'world_building' CHECK (reward_style IN ('world_building', 'collecting', 'story', 'challenge')),
  interests text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_engagement_profiles_updated ON student_engagement_profiles(updated_at DESC);
