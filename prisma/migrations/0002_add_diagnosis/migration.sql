ALTER TABLE "Incident"
ADD COLUMN "diagnosis" TEXT,
ADD COLUMN "likelyCause" TEXT,
ADD COLUMN "evidence" TEXT,
ADD COLUMN "recommendation" TEXT,
ADD COLUMN "confidence" DOUBLE PRECISION;
