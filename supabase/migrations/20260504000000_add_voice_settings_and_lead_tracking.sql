-- Migration: Voice settings and lead follow-up tracking
-- Aligns local migrations with the production form_submissions/voice_settings schema.

ALTER TABLE public.form_submissions
  DROP COLUMN IF EXISTS call_transcript,
  DROP COLUMN IF EXISTS call_collected_data,
  DROP COLUMN IF EXISTS call_duration_seconds;

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS lead_status TEXT NOT NULL DEFAULT 'new'
    CHECK (lead_status IN ('new', 'attended', 'follow_up', 'closed')),
  ADD COLUMN IF NOT EXISTS attended_by TEXT
    CHECK (attended_by IN ('automated', 'manual')),
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS call_notes TEXT,
  ADD COLUMN IF NOT EXISTS call_transcript_raw JSONB,
  ADD COLUMN IF NOT EXISTS call_transcript_text TEXT;

CREATE INDEX IF NOT EXISTS idx_form_submissions_lead_status
  ON public.form_submissions (lead_status);

CREATE INDEX IF NOT EXISTS idx_form_submissions_attended_by
  ON public.form_submissions (attended_by)
  WHERE attended_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.voice_settings (
  id BOOLEAN NOT NULL DEFAULT true CHECK (id = true),
  voice_agent_enabled BOOLEAN NOT NULL DEFAULT false,
  dev_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_settings_pkey PRIMARY KEY (id)
);

INSERT INTO public.voice_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.voice_settings IS 'Singleton admin-configurable voice agent settings.';
COMMENT ON COLUMN public.voice_settings.voice_agent_enabled IS 'Enables or disables AI voice-agent scheduling.';
COMMENT ON COLUMN public.voice_settings.dev_mode_enabled IS 'When true, voice calls use the configured development phone number.';
COMMENT ON COLUMN public.form_submissions.lead_status IS 'Overall lead workflow status independent of AI call_status.';
COMMENT ON COLUMN public.form_submissions.attended_by IS 'Who attended the lead: manual for staff follow-up, automated for AI voice-agent follow-up.';
COMMENT ON COLUMN public.form_submissions.attended_user_id IS 'Authenticated staff user who marked the lead attended when attended_by is manual.';
COMMENT ON COLUMN public.form_submissions.call_notes IS 'Unified follow-up notes, written by staff or generated from the AI voice-agent call.';
