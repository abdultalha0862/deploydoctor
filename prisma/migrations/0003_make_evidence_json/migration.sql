ALTER TABLE "Incident"
ALTER COLUMN "evidence" TYPE JSONB
USING "evidence"::jsonb;
