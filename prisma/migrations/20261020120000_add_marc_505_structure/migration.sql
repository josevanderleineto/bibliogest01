-- Preserve the existing human-readable 505 note while adding the MARC
-- representation used for indicators and subfields ($a, $g, $r and $t).
ALTER TABLE "catalog"
  ADD COLUMN IF NOT EXISTS "contentNote" TEXT,
  ADD COLUMN IF NOT EXISTS "contentNoteMarc" JSONB NOT NULL DEFAULT '{}';
