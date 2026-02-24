-- ============================================================================
-- Migration 001: Initial Schema
-- Dream Reality Admin Portal
--
-- Creates the three core tables: templates, deployments, form_submissions.
-- Assumes Supabase project with auth.users already available.
--
-- Run with: supabase db push  (or paste into Supabase SQL Editor)
-- ============================================================================

-- Enable UUID generation (should already be enabled in Supabase, but safe to call)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: templates
-- Registered Astro templates available in the admin dashboard template picker.
-- GitHub is the source of truth — manifest/config/default_data are cached copies.
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,
  framework     TEXT NOT NULL DEFAULT 'astro',
  github_repo   TEXT NOT NULL,
  manifest      JSONB NOT NULL,
  config        JSONB NOT NULL,
  default_data  JSONB,
  preview_url   TEXT,
  version       TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Category must be one of the allowed values
  CONSTRAINT chk_templates_category
    CHECK (category IN ('luxury', 'modern', 'investment', 'villa', 'affordable'))
);

-- Add comments for documentation
COMMENT ON TABLE templates IS 'Registered Astro templates available in the admin dashboard';
COMMENT ON COLUMN templates.slug IS 'URL-safe template ID, matches template.config.json → id';
COMMENT ON COLUMN templates.manifest IS 'Cached copy of template.manifest.json — sections, schemas, pages';
COMMENT ON COLUMN templates.config IS 'Cached copy of template.config.json — metadata for the picker';
COMMENT ON COLUMN templates.default_data IS 'Sample data/ folder contents from template repo, keyed by section ID';
COMMENT ON COLUMN templates.preview_url IS 'Live Cloudflare Pages URL for the preview iframe. NULL until deployed.';
COMMENT ON COLUMN templates.github_repo IS 'Full owner/repo path (e.g., dreamreality-templates/starter-01)';
COMMENT ON COLUMN templates.is_active IS 'false hides from template picker without deletion';

-- ============================================================================
-- TABLE: deployments
-- Each row represents one property website — from draft through live deployment.
-- site_data stores ALL property data as a single JSONB blob keyed by section ID.
-- template_manifest is a snapshot at creation time (not a live reference).
-- ============================================================================
CREATE TABLE IF NOT EXISTS deployments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name             TEXT NOT NULL,
  slug                     TEXT UNIQUE NOT NULL,
  template_id              UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  template_version         TEXT NOT NULL,
  template_manifest        JSONB NOT NULL,
  site_data                JSONB NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'draft',
  github_repo              TEXT,
  github_repo_url          TEXT,
  cloudflare_project_id    TEXT,
  cloudflare_project_name  TEXT,
  live_url                 TEXT,
  custom_domain            TEXT,
  site_token               TEXT UNIQUE,
  screenshot_url           TEXT,
  error_message            TEXT,
  build_logs               TEXT,
  status_log               JSONB NOT NULL DEFAULT '[]'::jsonb,
  has_unpublished_changes  BOOLEAN NOT NULL DEFAULT false,
  deployed_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deployed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status must be one of the allowed lifecycle states
  CONSTRAINT chk_deployments_status
    CHECK (status IN ('draft', 'deploying', 'building', 'live', 'failed', 'archived'))
);

COMMENT ON TABLE deployments IS 'Each row is one property website — draft through live deployment';
COMMENT ON COLUMN deployments.slug IS 'Used for GitHub repo name, CF project name, and *.pages.dev URL';
COMMENT ON COLUMN deployments.template_manifest IS 'Snapshot of manifest at creation time. Editor reads this, not the templates current manifest';
COMMENT ON COLUMN deployments.site_data IS 'All section data merged as JSONB keyed by section ID. Includes _sections key for registry';
COMMENT ON COLUMN deployments.site_token IS 'UUID for contact form auth. Generated once on first deploy. Never regenerated';
COMMENT ON COLUMN deployments.status_log IS 'Append-only JSONB array of status transitions with timestamps';
COMMENT ON COLUMN deployments.has_unpublished_changes IS 'true when site_data edited but not redeployed';
COMMENT ON COLUMN deployments.custom_domain IS 'Admin note only — no DNS automation';

-- ============================================================================
-- TABLE: form_submissions
-- Contact form submissions from deployed property websites.
-- Arrives via Supabase Edge Function (uses service role key, bypasses RLS).
-- ============================================================================
CREATE TABLE IF NOT EXISTS form_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id    UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  deployment_slug  TEXT NOT NULL,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  message          TEXT,
  source_url       TEXT NOT NULL,
  ip_address       TEXT,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE form_submissions IS 'Contact form submissions from deployed property sites via Edge Function';
COMMENT ON COLUMN form_submissions.deployment_slug IS 'Denormalized from deployments.slug for display without joins';
COMMENT ON COLUMN form_submissions.source_url IS 'HTTP Referer header — which page the form was on';
COMMENT ON COLUMN form_submissions.ip_address IS 'Used for rate limiting: max 10 per IP per hour';
COMMENT ON COLUMN form_submissions.is_read IS 'Admin marks as read in the enquiries tab';
