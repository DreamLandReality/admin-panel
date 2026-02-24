-- ============================================================================
-- Migration 002: Indexes
-- Dream Reality Admin Portal
--
-- Creates all secondary indexes for query performance.
-- Primary key and unique constraint indexes are created automatically in 001.
--
-- Automatically created by constraints (DO NOT recreate):
--   templates_pkey (id), templates_slug_key (slug)
--   deployments_pkey (id), deployments_slug_key (slug), deployments_site_token_key (site_token)
--   form_submissions_pkey (id)
-- ============================================================================

-- ============================================================================
-- TEMPLATES indexes
-- ============================================================================

-- Template picker: SELECT ... WHERE is_active = true
CREATE INDEX IF NOT EXISTS idx_templates_is_active
  ON templates (is_active)
  WHERE is_active = true;

-- Future: filter templates by category
CREATE INDEX IF NOT EXISTS idx_templates_category
  ON templates (category);

-- ============================================================================
-- DEPLOYMENTS indexes
-- ============================================================================

-- Dashboard: filter by status (live, draft, failed, etc.)
CREATE INDEX IF NOT EXISTS idx_deployments_status
  ON deployments (status);

-- Template detail: count deployments per template
CREATE INDEX IF NOT EXISTS idx_deployments_template_id
  ON deployments (template_id);

-- Future: filter deployments by user
CREATE INDEX IF NOT EXISTS idx_deployments_deployed_by
  ON deployments (deployed_by);

-- Dashboard: sort by most recent (default sort order)
CREATE INDEX IF NOT EXISTS idx_deployments_created_at
  ON deployments (created_at DESC);

-- Dashboard: combined status + recent sort (common filter + sort pattern)
CREATE INDEX IF NOT EXISTS idx_deployments_status_created
  ON deployments (status, created_at DESC);

-- ============================================================================
-- FORM_SUBMISSIONS indexes
-- ============================================================================

-- Enquiries tab: list submissions for a deployment
CREATE INDEX IF NOT EXISTS idx_submissions_deployment_id
  ON form_submissions (deployment_id);

-- Enquiries tab: sorted list without extra sort step (covers the common query)
CREATE INDEX IF NOT EXISTS idx_submissions_deployment_created
  ON form_submissions (deployment_id, created_at DESC);

-- Unread count badge: COUNT WHERE is_read = false
CREATE INDEX IF NOT EXISTS idx_submissions_is_read
  ON form_submissions (is_read)
  WHERE is_read = false;

-- Rate limiting in Edge Function:
-- SELECT COUNT(*) WHERE ip_address = ? AND created_at > now() - '1 hour'
CREATE INDEX IF NOT EXISTS idx_submissions_ip_created
  ON form_submissions (ip_address, created_at);

-- General time-based queries and sorting
CREATE INDEX IF NOT EXISTS idx_submissions_created_at
  ON form_submissions (created_at DESC);
