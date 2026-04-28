-- Migration 007: Remove legacy browser voice-call signed URL column
--
-- T-AP-05E moved dev and production voice calls to the server-owned
-- /api/voice-call/trigger path. The admin panel no longer generates or stores
-- ElevenLabs browser signed URLs, so this nullable column is dead schema.

ALTER TABLE public.form_submissions
  DROP COLUMN IF EXISTS call_signed_url;
