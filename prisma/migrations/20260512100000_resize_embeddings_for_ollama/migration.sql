-- Switch from OpenAI text-embedding-3-small (1536 dims) to Ollama
-- nomic-embed-text (768 dims). pgvector cannot compare vectors across
-- different dimensions, so we drop existing values (they were generated
-- against the old model and can't co-exist with the new query vectors)
-- and re-create the columns + HNSW indexes at the new dim.
--
-- Existing rows lose their semantic-similarity coverage until they're
-- re-embedded. The word-overlap path in loadFewShotExamples already
-- covers this fallback, and rows get re-embedded the next time they're
-- saved via embedRule / embedFormFieldFeedback / embedUserFieldRule.

DROP INDEX IF EXISTS "FormFieldFeedback_embedding_idx";
DROP INDEX IF EXISTS "UserFieldRule_embedding_idx";
DROP INDEX IF EXISTS "ATSFieldObservation_embedding_idx";
DROP INDEX IF EXISTS "ATSRule_embedding_idx";

ALTER TABLE "FormFieldFeedback" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "UserFieldRule" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "ATSFieldObservation" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "ATSRule" DROP COLUMN IF EXISTS "embedding";

ALTER TABLE "FormFieldFeedback"
  ADD COLUMN "embedding" vector(768);
ALTER TABLE "UserFieldRule"
  ADD COLUMN "embedding" vector(768);
ALTER TABLE "ATSFieldObservation"
  ADD COLUMN "embedding" vector(768);
ALTER TABLE "ATSRule"
  ADD COLUMN "embedding" vector(768);

CREATE INDEX "FormFieldFeedback_embedding_idx"
  ON "FormFieldFeedback"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "UserFieldRule_embedding_idx"
  ON "UserFieldRule"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "ATSFieldObservation_embedding_idx"
  ON "ATSFieldObservation"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "ATSRule_embedding_idx"
  ON "ATSRule"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
