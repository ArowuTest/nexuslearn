-- A non-reused version protects against stale edits even after profile recreation.
CREATE SEQUENCE student_engagement_version_seq AS bigint MAXVALUE 9007199254740991 NO CYCLE;
ALTER TABLE student_engagement_profiles
  ADD COLUMN version bigint NOT NULL DEFAULT nextval('student_engagement_version_seq'),
  ADD CONSTRAINT student_engagement_version_safe CHECK (version BETWEEN 1 AND 9007199254740991);
ALTER SEQUENCE student_engagement_version_seq OWNED BY student_engagement_profiles.version;
