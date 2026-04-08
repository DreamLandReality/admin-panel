-- Migration 004: Add call_signed_url for voice agent dev mode
-- Stores the ElevenLabs browser WebSocket URL temporarily.
-- Only populated in dev mode (VOICE_AGENT_DEV_MODE=true).
-- Cleared after the browser conversation starts.

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS call_signed_url TEXT;
