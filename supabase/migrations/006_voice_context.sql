-- Migration 006: Server-side property context for voice calls
-- call_property_context: built by submit-form edge function, read by trigger/route.ts + enquiry panel

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS call_property_context TEXT;
