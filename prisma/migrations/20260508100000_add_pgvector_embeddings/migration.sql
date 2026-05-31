-- Add embedding columns + HNSW indexes for semantic similarity search.
-- Used by:
--   FormFieldFeedback   — pull feedback for similar prior questions when
--                         answering a new field. "Are you a US citizen?"
--                         can match feedback you gave on "Eligible to work
--                         in the United States?" without re-teaching.
--   UserFieldRule       — same idea for user-taught rules.
--   ATSFieldObservation — cross-hostname rule reuse for the assist-training
--                         pipeline (label phrasing varies per site).
--   ATSRule             — promoted-rule matching for assist-training.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "FormFieldFeedback"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "UserFieldRule"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "ATSFieldObservation"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "ATSRule"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- HNSW: high recall + low latency. m=16 / ef_construction=64 are the
-- defaults recommended by pgvector for ~1k–10k rows; we'll tune if the
-- tables grow past that. cosine_ops because OpenAI text-embedding-3-small
-- produces normalized vectors and cosine is the standard distance.
CREATE INDEX IF NOT EXISTS "FormFieldFeedback_embedding_idx"
  ON "FormFieldFeedback"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "UserFieldRule_embedding_idx"
  ON "UserFieldRule"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "ATSFieldObservation_embedding_idx"
  ON "ATSFieldObservation"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "ATSRule_embedding_idx"
  ON "ATSRule"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
