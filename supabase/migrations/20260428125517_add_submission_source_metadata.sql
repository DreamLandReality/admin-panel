-- Store a server-resolved lead source snapshot on each submission.
-- form_type remains the raw template-submitted value; source_metadata is the
-- trusted display/filter metadata resolved from deployments.template_manifest
-- by the submit-form edge function at submission time.

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS source_metadata JSONB;

COMMENT ON COLUMN public.form_submissions.source_metadata IS
  'Server-resolved lead source snapshot from deployment manifest leadSources: id, label, kind, sectionId, gateId, known.';
