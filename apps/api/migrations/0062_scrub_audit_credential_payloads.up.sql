-- Remove credential values stored in audit_logs before this service stopped
-- writing them. Rows are kept. Top-level secret keys are removed, and the
-- same keys are removed from each object in a credentials array (legacy
-- class credential batches). Running this again changes nothing: a row is
-- updated only while one of those keys is still present. The down migration
-- cannot restore the values.
UPDATE audit_logs
SET payload = (
  SELECT CASE
    WHEN jsonb_typeof(body -> 'credentials') = 'array' THEN
      jsonb_set(
        body,
        '{credentials}',
        COALESCE((
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(element) = 'object' THEN
                element
                  - 'login_code'
                  - 'picture_password'
                  - 'qr_secret_hash'
                  - 'password'
                  - 'temporary_password'
                  - 'password_hash'
              ELSE element
            END
          )
          FROM jsonb_array_elements(body -> 'credentials') AS element
        ), '[]'::jsonb)
      )
    ELSE body
  END
  FROM (
    SELECT COALESCE(audit_logs.payload, '{}'::jsonb)
           - 'login_code'
           - 'picture_password'
           - 'qr_secret_hash'
           - 'password'
           - 'temporary_password'
           - 'password_hash' AS body
  ) AS stripped
)
WHERE payload ?| ARRAY[
    'login_code',
    'picture_password',
    'qr_secret_hash',
    'password',
    'temporary_password',
    'password_hash'
  ]
  OR (
    jsonb_typeof(payload -> 'credentials') = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(payload -> 'credentials') AS element
      WHERE jsonb_typeof(element) = 'object'
        AND element ?| ARRAY[
          'login_code',
          'picture_password',
          'qr_secret_hash',
          'password',
          'temporary_password',
          'password_hash'
        ]
    )
  );
