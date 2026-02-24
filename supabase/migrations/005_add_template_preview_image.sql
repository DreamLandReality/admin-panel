-- Add preview_image column to templates table
-- This column stores the static preview/thumbnail image URL for template gallery display

ALTER TABLE templates
ADD COLUMN preview_image TEXT;

COMMENT ON COLUMN templates.preview_image IS 'Static preview/thumbnail image URL for template gallery display';
