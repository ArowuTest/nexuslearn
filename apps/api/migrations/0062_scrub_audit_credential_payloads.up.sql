-- Remove credential values stored in audit_logs before this service stopped
-- writing them. Rows are kept; only the secret keys are removed.
-- The down migration cannot restore those values.
UPDATE audit_logs
SET payload = COALESCE(payload, '{}'::jsonb)
             - 'login_code'
             - 'picture_password'
             - 'qr_secret_hash'
             - 'password'
             - 'temporary_password'
             - 'password_hash'
WHERE payload ?| ARRAY[
  'login_code',
  'picture_password',
  'qr_secret_hash',
  'password',
  'temporary_password',
  'password_hash'
];
