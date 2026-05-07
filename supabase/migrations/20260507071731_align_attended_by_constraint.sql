-- Align legacy attended_by values and constraint with the current enquiry workflow.
-- Older databases may still allow a different enum-like set of values on this column.

ALTER TABLE public.form_submissions
  DROP CONSTRAINT IF EXISTS form_submissions_attended_by_check;

UPDATE public.form_submissions
SET attended_by = CASE
  WHEN attended_by IN ('voice_agent', 'ai', 'auto') THEN 'automated'
  WHEN attended_by IN ('sales', 'staff', 'human', 'manual_follow_up') THEN 'manual'
  WHEN attended_by IN ('automated', 'manual') THEN attended_by
  ELSE NULL
END
WHERE attended_by IS NOT NULL;

ALTER TABLE public.form_submissions
  ADD CONSTRAINT form_submissions_attended_by_check
  CHECK (attended_by IS NULL OR attended_by IN ('automated', 'manual'));
