-- Keep the launch subject identity in world configuration so the child portal
-- can be themed by backend data rather than duplicating curriculum metadata.
-- The version guard makes a replay safe and prevents overwriting an applied
-- migration on a partially restored development database.
UPDATE worlds
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
  'subject_lanes', '[
    {"key":"English","label":"English","short":"Words & stories","accent":"#f7a6d8","icon":"✦"},
    {"key":"Mathematics","label":"Mathematics","short":"Patterns & problem solving","accent":"#55cbd3","icon":"＋"},
    {"key":"Science","label":"Science","short":"Questions & discovery","accent":"#8be28f","icon":"◌"}
  ]'::jsonb,
  'subject_identity_version', 1
),
updated_at = now()
WHERE year_group BETWEEN 1 AND 7
  AND COALESCE(config->>'subject_identity_version', '') <> '1';
