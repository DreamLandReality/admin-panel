-- ============================================================================
-- Migration 001: Full Schema
-- Dream Reality Admin Portal
--
-- Covers: tables, indexes, functions, triggers, and RLS policies.
-- Written as a clean fresh install — no ALTER migrations needed.
--
-- Run with: supabase db push  (or paste into Supabase SQL Editor)
-- ============================================================================

-- Enable UUID generation (already available in Supabase, safe to call)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- TABLE: templates
-- Registered Astro templates available in the admin dashboard template picker.
-- GitHub is the source of truth — manifest/config/default_data are cached copies.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  category      TEXT        NOT NULL,
  framework     TEXT        NOT NULL DEFAULT 'astro',
  github_repo   TEXT        NOT NULL,
  manifest      JSONB       NOT NULL,
  config        JSONB       NOT NULL,
  default_data  JSONB,
  preview_url   TEXT,
  preview_image TEXT,
  version       TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_templates_category
    CHECK (category IN ('luxury', 'modern', 'investment', 'villa', 'affordable'))
);

COMMENT ON TABLE  public.templates IS 'Registered Astro templates available in the admin dashboard';
COMMENT ON COLUMN public.templates.slug          IS 'URL-safe template ID, matches template.config.json → id';
COMMENT ON COLUMN public.templates.manifest      IS 'Cached copy of template.manifest.json — sections, schemas, pages';
COMMENT ON COLUMN public.templates.config        IS 'Cached copy of template.config.json — metadata for the picker';
COMMENT ON COLUMN public.templates.default_data  IS 'Sample data/ folder contents from template repo, keyed by section ID';
COMMENT ON COLUMN public.templates.preview_url   IS 'Live Cloudflare Pages URL for the preview iframe. NULL until deployed.';
COMMENT ON COLUMN public.templates.preview_image IS 'Static preview/thumbnail image URL for template gallery display';
COMMENT ON COLUMN public.templates.github_repo   IS 'Full owner/repo path (e.g., dreamreality-templates/starter-01)';
COMMENT ON COLUMN public.templates.is_active     IS 'false hides from template picker without deletion';


-- ============================================================================
-- TABLE: deployments
-- Each row represents one property website — from draft through live deployment.
-- site_data stores ALL property data as a single JSONB blob keyed by section ID.
-- template_manifest is a snapshot at creation time (not a live reference).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deployments (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name             TEXT        NOT NULL,
  slug                     TEXT        UNIQUE NOT NULL,
  template_id              UUID        NOT NULL REFERENCES public.templates (id) ON DELETE RESTRICT,
  template_version         TEXT        NOT NULL,
  template_manifest        JSONB       NOT NULL,
  site_data                JSONB       NOT NULL,
  status                   TEXT        NOT NULL DEFAULT 'draft',
  github_repo              TEXT,
  live_url                 TEXT,
  custom_domain            TEXT,
  site_token               TEXT        UNIQUE,
  screenshot_url           TEXT,
  status_log               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  has_unpublished_changes  BOOLEAN     NOT NULL DEFAULT false,
  deployed_by              UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  deployed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_deployments_status
    CHECK (status IN ('draft', 'deploying', 'building', 'live', 'failed', 'archived'))
);

COMMENT ON TABLE  public.deployments IS 'Each row is one property website — draft through live deployment';
COMMENT ON COLUMN public.deployments.slug                    IS 'Used for GitHub repo name, CF project name, and *.pages.dev URL';
COMMENT ON COLUMN public.deployments.template_manifest       IS 'Snapshot of manifest at creation time. Editor reads this, not the templates current manifest';
COMMENT ON COLUMN public.deployments.site_data               IS 'All section data merged as JSONB keyed by section ID. Includes _sections key for registry';
COMMENT ON COLUMN public.deployments.site_token              IS 'UUID for contact form auth. Generated once on first deploy. Never regenerated';
COMMENT ON COLUMN public.deployments.status_log              IS 'Append-only JSONB array of status transitions with timestamps';
COMMENT ON COLUMN public.deployments.has_unpublished_changes IS 'true when site_data edited but not redeployed';
COMMENT ON COLUMN public.deployments.custom_domain           IS 'Admin note only — no DNS automation';


-- ============================================================================
-- TABLE: form_submissions
-- Contact form submissions from deployed property websites.
-- Arrives via Supabase Edge Function (uses service role key, bypasses RLS).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id    UUID        NOT NULL REFERENCES public.deployments (id) ON DELETE CASCADE,
  deployment_slug  TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  phone            TEXT,
  message          TEXT,
  source_url       TEXT        NOT NULL,
  ip_address       TEXT,
  is_read          BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.form_submissions IS 'Contact form submissions from deployed property sites via Edge Function';
COMMENT ON COLUMN public.form_submissions.deployment_slug IS 'Denormalized from deployments.slug for display without joins';
COMMENT ON COLUMN public.form_submissions.source_url      IS 'HTTP Referer header — which page the form was on';
COMMENT ON COLUMN public.form_submissions.ip_address      IS 'Used for rate limiting: max 10 per IP per hour';
COMMENT ON COLUMN public.form_submissions.is_read         IS 'Admin marks as read in the enquiries tab';


-- ============================================================================
-- TABLE: drafts
-- Stores in-progress wizard state so users can resume editing.
--
-- Two kinds of drafts:
--   1. New-site drafts  (deployment_id IS NULL):  wizard in-progress for a brand-new site.
--      Uniqueness enforced by the named constraint (user_id, project_name).
--      Upserted via /api/drafts POST with onConflict: 'user_id,project_name'.
--
--   2. Edit-site drafts (deployment_id IS NOT NULL): in-progress edits of a live deployment.
--      project_name stored as NULL — resolved at query time via join to deployments.
--      Uniqueness enforced at application level (SELECT-first, then UPDATE or INSERT).
--      Linked to the deployment; ON DELETE CASCADE cleans up automatically.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.drafts (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL,
  deployment_id     UUID        NULL,
  template_id       UUID        NULL,
  template_slug     TEXT        NOT NULL,
  current_step      INTEGER     NOT NULL DEFAULT 1,
  raw_text          TEXT        NULL DEFAULT ''::text,
  section_data      JSONB       NULL DEFAULT '{}'::jsonb,
  sections_registry JSONB       NULL DEFAULT '{}'::jsonb,
  collection_data   JSONB       NULL DEFAULT '{}'::jsonb,
  project_name      TEXT        NULL,
  site_slug         TEXT        NULL,
  last_active_page  TEXT        NULL DEFAULT 'home'::text,
  created_at        TIMESTAMPTZ NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NULL DEFAULT now(),

  CONSTRAINT drafts_pkey
    PRIMARY KEY (id),

  -- One new-site draft per user per project name (deployment_id IS NULL rows only)
  -- Used for upsert in /api/drafts POST when deployment_id is absent
  CONSTRAINT drafts_user_id_project_name_key
    UNIQUE (user_id, project_name),

  CONSTRAINT drafts_deployment_id_fkey
    FOREIGN KEY (deployment_id) REFERENCES public.deployments (id) ON DELETE CASCADE,

  CONSTRAINT drafts_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES public.templates (id),

  CONSTRAINT drafts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

COMMENT ON TABLE  public.drafts IS 'In-progress wizard saves — two kinds: new-site (deployment_id NULL) and edit-site (deployment_id set)';
COMMENT ON COLUMN public.drafts.user_id           IS 'Owner of the draft — FK to auth.users';
COMMENT ON COLUMN public.drafts.deployment_id     IS 'Set for edit-site drafts: FK to the deployment being re-edited. NULL for new-site wizard drafts.';
COMMENT ON COLUMN public.drafts.template_id       IS 'FK to templates — nullable in case template is later deleted';
COMMENT ON COLUMN public.drafts.template_slug     IS 'Denormalised slug for display without a join';
COMMENT ON COLUMN public.drafts.current_step      IS 'Last active wizard step (1=template, 2=data, 3=editor)';
COMMENT ON COLUMN public.drafts.project_name      IS 'Project name for new-site drafts. NULL for edit-site drafts (resolved via deployment join).';
COMMENT ON COLUMN public.drafts.section_data      IS 'All section field values keyed by section ID';
COMMENT ON COLUMN public.drafts.sections_registry IS 'Per-section enabled/disabled state';
COMMENT ON COLUMN public.drafts.collection_data   IS 'CMS collection items keyed by collection ID';
COMMENT ON COLUMN public.drafts.last_active_page  IS 'Active page in editor when draft was saved — restored on resume';


-- ============================================================================
-- INDEXES
-- ============================================================================

-- Templates: picker query (WHERE is_active = true)
CREATE INDEX IF NOT EXISTS idx_templates_is_active
  ON public.templates (is_active)
  WHERE is_active = true;

-- Templates: filter by category
CREATE INDEX IF NOT EXISTS idx_templates_category
  ON public.templates (category);

-- Deployments: filter by status (live, draft, failed, etc.)
CREATE INDEX IF NOT EXISTS idx_deployments_status
  ON public.deployments (status);

-- Deployments: count per template
CREATE INDEX IF NOT EXISTS idx_deployments_template_id
  ON public.deployments (template_id);

-- Deployments: filter by deploying user
CREATE INDEX IF NOT EXISTS idx_deployments_deployed_by
  ON public.deployments (deployed_by);

-- Deployments: default sort (most recent first)
CREATE INDEX IF NOT EXISTS idx_deployments_created_at
  ON public.deployments (created_at DESC);

-- Deployments: combined status + sort (common filter + sort pattern)
CREATE INDEX IF NOT EXISTS idx_deployments_status_created
  ON public.deployments (status, created_at DESC);

-- Form submissions: list for a deployment
CREATE INDEX IF NOT EXISTS idx_submissions_deployment_id
  ON public.form_submissions (deployment_id);

-- Form submissions: sorted list without extra sort step
CREATE INDEX IF NOT EXISTS idx_submissions_deployment_created
  ON public.form_submissions (deployment_id, created_at DESC);

-- Form submissions: unread count badge (WHERE is_read = false)
CREATE INDEX IF NOT EXISTS idx_submissions_is_read
  ON public.form_submissions (is_read)
  WHERE is_read = false;

-- Form submissions: rate limiting by IP
CREATE INDEX IF NOT EXISTS idx_submissions_ip_created
  ON public.form_submissions (ip_address, created_at);

-- Form submissions: general time-based sorting
CREATE INDEX IF NOT EXISTS idx_submissions_created_at
  ON public.form_submissions (created_at DESC);

-- Drafts: lookup by user + template
CREATE INDEX IF NOT EXISTS idx_drafts_user
  ON public.drafts (user_id, template_slug);

-- Drafts: lookup edit-site draft by deployment (one per user per deployment, enforced by app)
CREATE INDEX IF NOT EXISTS idx_drafts_deployment_id
  ON public.drafts (deployment_id)
  WHERE deployment_id IS NOT NULL;


-- ============================================================================
-- FUNCTION: update_updated_at
-- Auto-sets updated_at = now() on any UPDATE. Applied to all tables that
-- have an updated_at column.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_updated_at   ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_deployments_updated_at ON public.deployments;
CREATE TRIGGER trg_deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_drafts_updated_at      ON public.drafts;
CREATE TRIGGER trg_drafts_updated_at
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================================
-- FUNCTION: generate_unique_slug
-- Converts a project name to a URL-safe slug and ensures uniqueness in
-- the deployments table by appending -2, -3, etc. on collision.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_unique_slug(project_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  suffix    INT := 2;
  exists    BOOLEAN;
BEGIN
  base_slug := lower(project_name);
  base_slug := regexp_replace(base_slug, '[^a-z0-9\-]', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  base_slug := trim(both '-' from base_slug);

  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'property-site';
  END IF;

  candidate := base_slug;

  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.deployments WHERE slug = candidate
    ) INTO exists;

    IF NOT exists THEN
      RETURN candidate;
    END IF;

    candidate := base_slug || '-' || suffix;
    suffix    := suffix + 1;

    IF suffix > 100 THEN
      RAISE EXCEPTION 'Could not generate unique slug for: %', project_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_unique_slug(TEXT) IS
  'Generates a URL-safe slug from a project name, appending -2, -3, etc. for uniqueness';


-- ============================================================================
-- FUNCTION: append_status_log
-- Atomically appends a status entry to a deployment's status_log JSONB array
-- and updates the deployment's status field in the same statement.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.append_status_log(
  p_deployment_id UUID,
  p_status        TEXT,
  p_step          TEXT    DEFAULT NULL,
  p_message       TEXT    DEFAULT '',
  p_metadata      JSONB   DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  new_entry JSONB;
BEGIN
  new_entry := jsonb_build_object(
    'status',   p_status,
    'step',     p_step,
    'message',  p_message,
    'at',       to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'metadata', p_metadata
  );

  UPDATE public.deployments
  SET
    status_log = status_log || jsonb_build_array(new_entry),
    status     = p_status,
    updated_at = now()
  WHERE id = p_deployment_id;
END;
$$;

COMMENT ON FUNCTION public.append_status_log(UUID, TEXT, TEXT, TEXT, JSONB) IS
  'Atomically appends a status entry to a deployments status_log and updates the status';


-- ============================================================================
-- ROW LEVEL SECURITY
-- All tables: authenticated users with app_metadata.user_role = 'admin' get
-- full access. The Edge Function uses service_role key which bypasses RLS.
--
-- NOTE: Apply RLS before production deployment.
-- During local development (Phase 0-3) you may leave RLS disabled to avoid
-- "no rows returned" issues when JWT claims are not yet configured.
-- ============================================================================

ALTER TABLE public.templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts          ENABLE ROW LEVEL SECURITY;

-- Templates: admin full access
CREATE POLICY "Admins can manage templates"
  ON public.templates
  FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

-- Deployments: admin full access
CREATE POLICY "Admins can manage deployments"
  ON public.deployments
  FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

-- Form submissions: admin full access (Edge Function INSERTs via service_role, bypasses RLS)
CREATE POLICY "Admins can manage form submissions"
  ON public.form_submissions
  FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

-- Drafts: each user can only see and modify their own drafts
CREATE POLICY "Admins can manage drafts"
  ON public.drafts
  FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');
