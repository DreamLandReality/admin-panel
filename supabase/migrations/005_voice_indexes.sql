-- Index for ElevenLabs webhook lookup by conversation ID.
-- Partial index: only rows where conversation_id is set (excludes all pending/skipped rows).
CREATE INDEX IF NOT EXISTS idx_form_submissions_conversation_id
  ON form_submissions (elevenlabs_conversation_id)
  WHERE elevenlabs_conversation_id IS NOT NULL;
