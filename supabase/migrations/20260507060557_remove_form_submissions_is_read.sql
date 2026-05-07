-- Remove legacy is_read state now that enquiries use lead_status as the
-- single workflow state: new, attended, follow_up, closed.

DROP INDEX IF EXISTS public.idx_submissions_is_read;

ALTER TABLE public.form_submissions
  DROP COLUMN IF EXISTS is_read;
