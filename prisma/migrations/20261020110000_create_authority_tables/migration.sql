-- Reusable authority records. Catalog keeps its current MARC string arrays,
-- so this migration is additive and does not rewrite existing bibliographic data.
CREATE TABLE IF NOT EXISTS "authority_authors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "variantNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "viafId" TEXT,
  "lccnId" TEXT,
  "source" TEXT,
  "note" TEXT,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "authority_authors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "authority_authors_name_key" ON "authority_authors"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "authority_authors_normalized_key" ON "authority_authors"("normalized");
CREATE INDEX IF NOT EXISTS "authority_authors_source_idx" ON "authority_authors"("source");

CREATE TABLE IF NOT EXISTS "authority_subjects" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "broaderTerm" TEXT,
  "narrowerTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "relatedTerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source" TEXT,
  "note" TEXT,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "authority_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "authority_subjects_term_key" ON "authority_subjects"("term");
CREATE UNIQUE INDEX IF NOT EXISTS "authority_subjects_normalized_key" ON "authority_subjects"("normalized");
CREATE INDEX IF NOT EXISTS "authority_subjects_source_idx" ON "authority_subjects"("source");
CREATE INDEX IF NOT EXISTS "authority_subjects_broaderTerm_idx" ON "authority_subjects"("broaderTerm");

CREATE TABLE IF NOT EXISTS "authority_publishers" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "place" TEXT,
  "country" TEXT,
  "isbnPrefix" TEXT,
  "source" TEXT,
  "note" TEXT,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "authority_publishers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "authority_publishers_name_key" ON "authority_publishers"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "authority_publishers_normalized_key" ON "authority_publishers"("normalized");
CREATE INDEX IF NOT EXISTS "authority_publishers_place_idx" ON "authority_publishers"("place");
CREATE INDEX IF NOT EXISTS "authority_publishers_source_idx" ON "authority_publishers"("source");
