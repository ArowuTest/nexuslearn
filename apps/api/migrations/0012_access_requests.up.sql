CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('parent', 'school', 'tutor_org')),
  organisation_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  learner_count integer CHECK (learner_count IS NULL OR learner_count > 0),
  year_groups integer[] NOT NULL DEFAULT '{}',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'waitlisted', 'rejected', 'converted')),
  source text NOT NULL DEFAULT 'public_site',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status_created ON access_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_contact_email ON access_requests(contact_email);
CREATE INDEX IF NOT EXISTS idx_access_requests_type ON access_requests(request_type);
