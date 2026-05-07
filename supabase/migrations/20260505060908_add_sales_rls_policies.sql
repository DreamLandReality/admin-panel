-- Add sales role RLS support without weakening existing admin policies.
-- Sales can read live sites, read enquiries, and update only manual follow-up fields.

CREATE POLICY "Sales can read live deployments"
  ON public.deployments
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales'
    AND status = 'live'
  );

CREATE POLICY "Sales can read form submissions"
  ON public.form_submissions
  FOR SELECT TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales');

CREATE POLICY "Sales can update form submission follow up"
  ON public.form_submissions
  FOR UPDATE TO authenticated
  USING (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales')
  WITH CHECK (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales');

CREATE OR REPLACE FUNCTION public.enforce_sales_form_submission_follow_up_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  request_role TEXT;
  request_user_id UUID;
BEGIN
  request_role := (select auth.jwt()) -> 'app_metadata' ->> 'user_role';

  IF request_role IS DISTINCT FROM 'sales' THEN
    RETURN NEW;
  END IF;

  IF
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.deployment_id IS DISTINCT FROM OLD.deployment_id OR
    NEW.deployment_slug IS DISTINCT FROM OLD.deployment_slug OR
    NEW.name IS DISTINCT FROM OLD.name OR
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.phone IS DISTINCT FROM OLD.phone OR
    NEW.message IS DISTINCT FROM OLD.message OR
    NEW.source_url IS DISTINCT FROM OLD.source_url OR
    NEW.ip_address IS DISTINCT FROM OLD.ip_address OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.form_type IS DISTINCT FROM OLD.form_type OR
    NEW.source_metadata IS DISTINCT FROM OLD.source_metadata OR
    NEW.call_status IS DISTINCT FROM OLD.call_status OR
    NEW.call_scheduled_at IS DISTINCT FROM OLD.call_scheduled_at OR
    NEW.call_scheduled_for IS DISTINCT FROM OLD.call_scheduled_for OR
    NEW.call_completed_at IS DISTINCT FROM OLD.call_completed_at OR
    NEW.elevenlabs_conversation_id IS DISTINCT FROM OLD.elevenlabs_conversation_id OR
    NEW.call_attempts IS DISTINCT FROM OLD.call_attempts OR
    NEW.call_property_context IS DISTINCT FROM OLD.call_property_context OR
    NEW.call_transcript_raw IS DISTINCT FROM OLD.call_transcript_raw OR
    NEW.call_transcript_text IS DISTINCT FROM OLD.call_transcript_text
  THEN
    RAISE EXCEPTION 'Sales users may update only approved follow-up fields'
      USING ERRCODE = '42501';
  END IF;

  request_user_id := (select auth.uid());

  IF NEW.attended_by IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'Sales follow-up updates must set attended_by to manual'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.attended_user_id IS DISTINCT FROM request_user_id THEN
    RAISE EXCEPTION 'Sales follow-up updates must set attended_user_id to the current user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.attended_at IS NULL THEN
    RAISE EXCEPTION 'Sales follow-up updates must set attended_at'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_sales_form_submission_follow_up_update() IS
  'Rejects sales-role updates that try to change anything outside the approved manual follow-up fields.';

DROP TRIGGER IF EXISTS trg_sales_form_submission_follow_up_guard ON public.form_submissions;

CREATE TRIGGER trg_sales_form_submission_follow_up_guard
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sales_form_submission_follow_up_update();

ALTER TABLE public.voice_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage voice settings"
  ON public.voice_settings;
