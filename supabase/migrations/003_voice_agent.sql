-- ============================================================
-- Migration 003: Voice Agent Support
-- Adds call tracking columns to form_submissions
-- ============================================================

ALTER TABLE form_submissions
  ADD COLUMN call_status TEXT DEFAULT 'pending'
    CHECK (call_status IN (
      'pending',
      'scheduled',
      'calling',
      'completed',
      'no_answer',
      'failed',
      'cancelled',
      'skipped'
    ));

ALTER TABLE form_submissions
  ADD COLUMN call_scheduled_at TIMESTAMPTZ,
  ADD COLUMN call_scheduled_for TIMESTAMPTZ,
  ADD COLUMN call_completed_at TIMESTAMPTZ;

ALTER TABLE form_submissions
  ADD COLUMN elevenlabs_conversation_id TEXT,
  ADD COLUMN call_transcript TEXT,
  ADD COLUMN call_collected_data JSONB,
  ADD COLUMN call_attempts INTEGER DEFAULT 0,
  ADD COLUMN call_duration_seconds INTEGER;

-- Index for active call queries
CREATE INDEX idx_submissions_call_status
  ON form_submissions (call_status)
  WHERE call_status NOT IN ('completed', 'skipped', 'cancelled');
