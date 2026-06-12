ALTER TABLE access_requests
  ADD COLUMN IF NOT EXISTS support_needs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_priorities text[] NOT NULL DEFAULT '{}';
