UPDATE worlds
SET config = config - 'subject_lanes' - 'subject_identity_version',
    updated_at = now()
WHERE year_group BETWEEN 1 AND 7
  AND config->>'subject_identity_version' = '1';
