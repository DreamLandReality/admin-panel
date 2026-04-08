-- ============================================================================
-- Migration 002: Add form_type to form_submissions
-- Distinguishes which form on the site generated the enquiry.
-- Values: 'contact' (ContactForm) | 'price-unlock' (PriceUnlock / UnlockPrice)
-- ============================================================================

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS form_type TEXT NOT NULL DEFAULT 'contact';

COMMENT ON COLUMN public.form_submissions.form_type IS
  'Which form generated this submission: contact | price-unlock';

CREATE INDEX IF NOT EXISTS idx_submissions_form_type
  ON public.form_submissions (form_type);
