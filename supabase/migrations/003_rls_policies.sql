-- ============================================================================
-- Migration 003: Row Level Security (RLS) Policies
-- Dream Reality Admin Portal
--
-- Applied in Phase 4 (before production deployment).
-- DO NOT apply in Phase 0-3 (local development with next dev).
--
-- All policies: authenticated users with user_role = 'admin' get full access.
-- The Edge Function uses service_role key which bypasses RLS entirely.
-- ============================================================================

-- ============================================================================
-- IMPORTANT: When to apply this migration
--
-- Phase 0-3: Do NOT enable RLS. You're running locally with next dev.
--            RLS adds complexity during development and can cause
--            "no rows returned" bugs if JWT claims don't match policies.
--
-- Phase 4:   Enable RLS before deploying the admin dashboard to production.
--            Without RLS, anyone who discovers the Supabase URL and anon key
--            could read/write deployment data.
--
-- After enabling: Test EVERY query in the application. RLS silently filters
-- rows — a misconfigured policy shows as "no data" instead of an error.
-- ============================================================================

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TEMPLATES policies
-- All admins can read and write all templates.
-- ============================================================================

-- Admin full access to templates
CREATE POLICY "Admins can manage templates"
  ON templates
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- ============================================================================
-- DEPLOYMENTS policies
-- All admins can read and write all deployments.
-- No per-user isolation — all admins see all deployments.
-- ============================================================================

-- Admin full access to deployments
CREATE POLICY "Admins can manage deployments"
  ON deployments
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- ============================================================================
-- FORM_SUBMISSIONS policies
-- Admins can read all submissions and mark them as read.
-- The Edge Function INSERTS via service_role (bypasses RLS) — no insert policy
-- needed for the Edge Function. But admins may also need to view submissions
-- via the dashboard, so we allow full access.
-- ============================================================================

-- Admin full access to form submissions
CREATE POLICY "Admins can manage form submissions"
  ON form_submissions
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin'
  );

-- ============================================================================
-- EDGE FUNCTION NOTE
--
-- The Supabase Edge Function (form-submit) uses the SUPABASE_SERVICE_ROLE_KEY.
-- The service role bypasses ALL RLS policies. This is correct because:
--
-- 1. The Edge Function needs to SELECT from deployments (token lookup) and
--    INSERT into form_submissions — both without a user JWT.
-- 2. The Edge Function validates requests via siteToken, not via user auth.
-- 3. The service role key is never exposed to the browser.
--
-- If you ever add a non-admin role or public API, create specific policies
-- for those roles. Do NOT weaken the admin-only policies above.
-- ============================================================================
