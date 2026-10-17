DROP TABLE IF EXISTS data_deletion_records;
DROP TABLE IF EXISTS family_privacy_settings;
DROP TABLE IF EXISTS parental_consents;
ALTER TABLE students DROP COLUMN IF EXISTS consent_required;
