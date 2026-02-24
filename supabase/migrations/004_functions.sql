-- ============================================================================
-- Migration 004: Database Functions
-- Dream Reality Admin Portal
--
-- Helper functions for common operations:
--   1. generate_unique_slug() — slug generation with collision handling
--   2. append_status_log()    — atomic append to deployment status_log
--   3. update_updated_at()    — auto-update updated_at on row changes
--   4. seed_starter_template() — seed the first template (starter-01)
-- ============================================================================

-- ============================================================================
-- FUNCTION: generate_unique_slug
--
-- Converts a project name into a URL-safe slug and ensures uniqueness
-- by appending -2, -3, etc. if needed.
--
-- Algorithm (from architecture/06-database-design.md):
--   1. Lowercase
--   2. Replace spaces and special chars with hyphens
--   3. Remove consecutive hyphens
--   4. Trim leading/trailing hyphens
--   5. Truncate to 50 chars
--   6. Check uniqueness, append suffix if collision
--
-- Usage:
--   SELECT generate_unique_slug('Marina Bay Whitefield');
--   → 'marina-bay-whitefield'  (or 'marina-bay-whitefield-2' if taken)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_unique_slug(project_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  suffix INT := 2;
  slug_exists BOOLEAN;
BEGIN
  -- Step 1-4: Slugify
  base_slug := project_name;
  base_slug := lower(base_slug);                                    -- lowercase
  base_slug := regexp_replace(base_slug, '[^a-z0-9\-]', '-', 'g'); -- replace non-alphanumeric
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');           -- collapse consecutive hyphens
  base_slug := trim(both '-' from base_slug);                       -- trim leading/trailing hyphens

  -- Step 5: Truncate to 50 characters
  base_slug := left(base_slug, 50);
  base_slug := trim(both '-' from base_slug);  -- re-trim in case truncation left a trailing hyphen

  -- Handle empty slug (edge case: name was all special chars)
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'property-site';
  END IF;

  -- Step 6: Check uniqueness
  candidate := base_slug;

  LOOP
    SELECT EXISTS(
      SELECT 1 FROM deployments WHERE slug = candidate
    ) INTO slug_exists;

    IF NOT slug_exists THEN
      RETURN candidate;
    END IF;

    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;

    -- Safety: prevent infinite loop (extremely unlikely)
    IF suffix > 100 THEN
      RAISE EXCEPTION 'Could not generate unique slug for: %', project_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION generate_unique_slug(TEXT) IS
  'Generates a URL-safe slug from a project name, appending -2, -3, etc. for uniqueness';

-- ============================================================================
-- FUNCTION: append_status_log
--
-- Atomically appends a new entry to a deployment's status_log JSONB array.
-- Uses the || operator for atomic append — no read-modify-write race.
--
-- Usage:
--   SELECT append_status_log(
--     '550e8400-e29b-41d4-a716-446655440000',  -- deployment_id
--     'deploying',                                -- status
--     'create_repo',                              -- step (nullable)
--     'GitHub repository created'                 -- message
--   );
-- ============================================================================
CREATE OR REPLACE FUNCTION append_status_log(
  p_deployment_id UUID,
  p_status TEXT,
  p_step TEXT DEFAULT NULL,
  p_message TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  new_entry JSONB;
BEGIN
  new_entry := jsonb_build_object(
    'status', p_status,
    'step', p_step,
    'message', p_message,
    'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'metadata', p_metadata
  );

  UPDATE deployments
  SET
    status_log = status_log || jsonb_build_array(new_entry),
    status = p_status,
    updated_at = now()
  WHERE id = p_deployment_id;
END;
$$;

COMMENT ON FUNCTION append_status_log(UUID, TEXT, TEXT, TEXT, JSONB) IS
  'Atomically appends a status entry to a deployments status_log and updates the status';

-- ============================================================================
-- TRIGGER: auto-update updated_at
--
-- Automatically sets updated_at = now() on any UPDATE to templates or deployments.
-- Ensures updated_at is always accurate even if the application forgets to set it.
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to templates
DROP TRIGGER IF EXISTS trg_templates_updated_at ON templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Apply to deployments
DROP TRIGGER IF EXISTS trg_deployments_updated_at ON deployments;
CREATE TRIGGER trg_deployments_updated_at
  BEFORE UPDATE ON deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FUNCTION: seed_starter_template
--
-- Seeds the first template (starter-01) into the templates table.
-- This is run ONCE during Phase 0 setup. After Phase 4, new templates
-- are registered via the admin dashboard UI, not via SQL.
--
-- IMPORTANT: Replace the manifest, config, and default_data JSON below
-- with the actual contents from the starter-01 template repo.
-- The placeholders below show the structure — actual content comes from:
--   template.manifest.json → manifest column
--   template.config.json   → config column
--   data/ folder contents  → default_data column (keyed by section ID)
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_starter_template()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only insert if not already present
  IF NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'starter-01') THEN
    INSERT INTO templates (
      slug,
      name,
      description,
      category,
      framework,
      github_repo,
      manifest,
      config,
      default_data,
      preview_url,
      version
    ) VALUES (
      'starter-01',
      'Starter Essential',
      'Clean, fast-loading property page with essential sections for affordable and mid-range properties',
      'affordable',
      'astro',
      'dreamreality-templates/starter-01',

      -- manifest: Replace with actual template.manifest.json contents
      '{
        "templateId": "starter-01",
        "version": "1.0.0",
        "sections": [
          {
            "id": "seo",
            "name": "SEO & Meta Tags",
            "description": "Page title, meta description, Open Graph tags, Twitter Cards, and JSON-LD structured data for search engines",
            "dataFile": "seo.json",
            "required": true,
            "visible": false,
            "page": "home",
            "imageSlots": ["image"],
            "schema": {
              "type": "object",
              "properties": {
                "title": { "type": "string", "description": "Page title for browser tab and search results (50-60 chars)", "uiLabel": "Page Title" },
                "description": { "type": "string", "description": "Meta description for search results (150-160 chars)", "uiLabel": "Meta Description", "uiWidget": "textarea" },
                "keywords": { "type": "array", "items": { "type": "string" }, "description": "SEO keywords for the property", "uiLabel": "Keywords", "uiWidget": "tagInput" },
                "image": { "type": "string", "description": "OG image URL (1200x630)", "uiLabel": "OG Image", "uiWidget": "imageUpload" },
                "imageAlt": { "type": "string", "description": "Alt text for OG image", "uiLabel": "OG Image Alt" },
                "locale": { "type": "string", "description": "Locale code (e.g., en_IN)", "uiLabel": "Locale" },
                "language": { "type": "string", "description": "Language code (e.g., en)", "uiLabel": "Language" },
                "canonicalUrl": { "type": "string", "description": "Canonical URL (injected at deploy time)", "uiLabel": "Canonical URL" },
                "structuredData": { "type": "object", "description": "JSON-LD structured data", "uiLabel": "Structured Data" }
              }
            }
          },
          {
            "id": "navigation",
            "name": "Navigation",
            "description": "Top navigation bar with logo, menu links, and call-to-action button",
            "dataFile": "navigation.json",
            "required": true,
            "visible": true,
            "page": "*",
            "imageSlots": ["logo.image"],
            "schema": {
              "type": "object",
              "properties": {
                "logo": { "type": "object", "description": "Site logo", "uiLabel": "Logo" },
                "links": { "type": "array", "items": { "type": "object" }, "description": "Navigation menu items", "uiLabel": "Menu Links", "uiWidget": "repeater" },
                "ctaButton": { "type": "object", "description": "Call-to-action button in nav", "uiLabel": "CTA Button" }
              }
            }
          },
          {
            "id": "hero",
            "name": "Hero Section",
            "description": "Full-width hero banner with headline, subtext, CTA button, and background image",
            "dataFile": "hero.json",
            "required": true,
            "visible": true,
            "page": "home",
            "imageSlots": ["backgroundImage"],
            "schema": {
              "type": "object",
              "properties": {
                "headline": { "type": "string", "description": "Main headline (property name or tagline)", "uiLabel": "Headline" },
                "subtext": { "type": "string", "description": "Supporting text below headline", "uiLabel": "Subtext" },
                "backgroundImage": { "type": "string", "description": "Hero background image URL", "uiLabel": "Background Image", "uiWidget": "imageUpload" },
                "backgroundImageAlt": { "type": "string", "description": "Alt text for hero image", "uiLabel": "Image Alt Text" },
                "ctaButton": { "type": "object", "description": "Hero CTA button", "uiLabel": "CTA Button" }
              }
            }
          },
          {
            "id": "overview",
            "name": "Property Overview",
            "description": "Property summary with key highlights, description text, and feature badges",
            "dataFile": "overview.json",
            "required": false,
            "visible": true,
            "page": "home",
            "imageSlots": [],
            "schema": {
              "type": "object",
              "properties": {
                "heading": { "type": "string", "description": "Section heading", "uiLabel": "Heading" },
                "description": { "type": "string", "description": "Property description paragraph", "uiLabel": "Description", "uiWidget": "textarea" },
                "highlights": { "type": "array", "items": { "type": "object" }, "description": "Key property highlights (e.g., 2-3 BHK, 1200 sq ft)", "uiLabel": "Highlights", "uiWidget": "repeater" }
              }
            }
          },
          {
            "id": "pricing",
            "name": "Pricing",
            "description": "Property pricing table with unit configurations, sizes, and prices",
            "dataFile": "pricing.json",
            "required": false,
            "visible": true,
            "page": "home",
            "imageSlots": [],
            "schema": {
              "type": "object",
              "properties": {
                "heading": { "type": "string", "description": "Section heading", "uiLabel": "Heading" },
                "subtext": { "type": "string", "description": "Pricing context text", "uiLabel": "Subtext" },
                "configurations": { "type": "array", "items": { "type": "object" }, "description": "Unit configurations with type, size, and price", "uiLabel": "Configurations", "uiWidget": "repeater" }
              }
            }
          },
          {
            "id": "contact-form",
            "name": "Contact Form",
            "description": "Lead generation contact form with name, email, phone, and message fields",
            "dataFile": "contact-form.json",
            "required": true,
            "visible": true,
            "page": "home",
            "imageSlots": [],
            "schema": {
              "type": "object",
              "properties": {
                "heading": { "type": "string", "description": "Form section heading", "uiLabel": "Heading" },
                "subtext": { "type": "string", "description": "Text below the heading", "uiLabel": "Subtext" },
                "submitButton": { "type": "string", "description": "Submit button text", "uiLabel": "Submit Button Text" },
                "successMessage": { "type": "string", "description": "Message shown after successful submission", "uiLabel": "Success Message" },
                "submissionEndpoint": { "type": "string", "description": "Edge Function URL (injected at deploy time)", "uiLabel": "Submission Endpoint" },
                "siteToken": { "type": "string", "description": "Site auth token (injected at deploy time)", "uiLabel": "Site Token" }
              }
            }
          },
          {
            "id": "footer",
            "name": "Footer",
            "description": "Site footer with company info, RERA number, disclaimer, and copyright",
            "dataFile": "footer.json",
            "required": true,
            "visible": true,
            "page": "*",
            "imageSlots": [],
            "schema": {
              "type": "object",
              "properties": {
                "companyName": { "type": "string", "description": "Developer/company name", "uiLabel": "Company Name" },
                "reraNumber": { "type": "string", "description": "RERA registration number", "uiLabel": "RERA Number" },
                "disclaimer": { "type": "string", "description": "Legal disclaimer text", "uiLabel": "Disclaimer", "uiWidget": "textarea" },
                "copyright": { "type": "string", "description": "Copyright text", "uiLabel": "Copyright" }
              }
            }
          }
        ]
      }'::jsonb,

      -- config: Replace with actual template.config.json contents
      '{
        "id": "starter-01",
        "name": "Starter Essential",
        "description": "Clean, fast-loading property page with essential sections",
        "category": "affordable",
        "buildCommand": "npm run build",
        "outputDirectory": "dist",
        "previewUrl": null,
        "version": "1.0.0",
        "sectionCount": 7,
        "previewRuntimeVersion": "1.0.0"
      }'::jsonb,

      -- default_data: Replace with actual data/ folder contents
      -- This is the merged sample data, keyed by section ID
      '{
        "seo": {
          "title": "Marina Bay Whitefield | Premium 2 & 3 BHK Apartments",
          "description": "Discover Marina Bay — luxury apartments in Whitefield, Bangalore. Starting from ₹85 Lakhs.",
          "keywords": ["marina bay whitefield", "2 bhk whitefield", "prestige group bangalore"],
          "image": "https://placehold.co/1200x630",
          "imageAlt": "Aerial view of Marina Bay residential towers",
          "locale": "en_IN",
          "language": "en",
          "canonicalUrl": null,
          "structuredData": {
            "propertyName": "Marina Bay",
            "propertyType": "Apartment",
            "description": "Premium 2 & 3 BHK apartments in Whitefield, Bangalore",
            "url": null,
            "datePosted": null,
            "priceRange": { "low": 8500000, "high": 15000000, "currency": "INR" },
            "address": { "street": "Whitefield Main Road", "locality": "Whitefield", "region": "Karnataka", "postalCode": "560066", "country": "IN" },
            "geo": { "latitude": null, "longitude": null },
            "developer": { "name": "Prestige Group", "url": "https://www.prestigeconstructions.com", "logo": "https://placehold.co/200x60" }
          }
        },
        "navigation": {
          "logo": { "text": "Marina Bay", "image": null, "imageAlt": null },
          "links": [
            { "label": "Overview", "href": "#overview" },
            { "label": "Pricing", "href": "#pricing" },
            { "label": "Contact", "href": "#contact-form" }
          ],
          "ctaButton": { "text": "Enquire Now", "href": "#contact-form" }
        },
        "hero": {
          "headline": "Marina Bay Whitefield",
          "subtext": "Premium 2 & 3 BHK apartments in the heart of Whitefield, Bangalore",
          "backgroundImage": "https://placehold.co/1920x1080",
          "backgroundImageAlt": "Aerial view of Marina Bay residential towers and landscaped gardens",
          "ctaButton": { "text": "View Pricing", "href": "#pricing" }
        },
        "overview": {
          "heading": "About Marina Bay",
          "description": "Marina Bay is a premium residential project by Prestige Group, offering thoughtfully designed 2 and 3 BHK apartments in Whitefield, Bangalore. With world-class amenities and excellent connectivity to IT hubs, this project redefines modern living.",
          "highlights": [
            { "icon": "home", "label": "2 & 3 BHK", "value": "Configurations" },
            { "icon": "maximize", "label": "1,100 - 1,850", "value": "Sq. Ft." },
            { "icon": "map-pin", "label": "Whitefield", "value": "Location" }
          ]
        },
        "pricing": {
          "heading": "Pricing",
          "subtext": "Transparent pricing for all configurations",
          "configurations": [
            { "type": "2 BHK", "size": "1,100 sq. ft.", "price": "₹85 Lakhs onwards" },
            { "type": "3 BHK", "size": "1,450 sq. ft.", "price": "₹1.1 Cr onwards" },
            { "type": "3 BHK Premium", "size": "1,850 sq. ft.", "price": "₹1.5 Cr onwards" }
          ]
        },
        "contact-form": {
          "heading": "Get in Touch",
          "subtext": "Register your interest and our team will contact you within 24 hours",
          "submitButton": "Submit Enquiry",
          "successMessage": "Thank you! Our team will contact you within 24 hours.",
          "submissionEndpoint": null,
          "siteToken": null
        },
        "footer": {
          "companyName": "Prestige Group",
          "reraNumber": "PRM/KA/RERA/1251/309/AG/180724/003456",
          "disclaimer": "This is not an offer or solicitation. The project is subject to RERA regulations. All images are artist impressions.",
          "copyright": "© 2025 Prestige Group. All rights reserved."
        }
      }'::jsonb,

      NULL,      -- preview_url: set after deploying template to CF Pages
      '1.0.0'    -- version
    );

    RAISE NOTICE 'Starter template (starter-01) seeded successfully';
  ELSE
    RAISE NOTICE 'Starter template (starter-01) already exists, skipping seed';
  END IF;
END;
$$;

COMMENT ON FUNCTION seed_starter_template() IS
  'Seeds the starter-01 template into the templates table. Run once during Phase 0 setup.';

-- ============================================================================
-- Execute the seed function
-- Uncomment the line below when running this migration for the first time.
-- After Phase 4, templates are registered via the admin dashboard UI.
-- ============================================================================
-- SELECT seed_starter_template();
