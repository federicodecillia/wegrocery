-- The group's identity edited by its admins in the app (first-run setup and
-- Impostazioni), on top of the deploy's NEXT_PUBLIC_BRAND_JSON: a new group
-- no longer needs a redeploy to get its name, logo and colours.
--
-- group_identity.overrides            jsonb of the fields set by the admins
--                                     (names, contacts, links, colours);
--                                     a field left out keeps the brand
--                                     JSON's. Read through getBrand
--                                     (lib/brand/get-brand.ts).
-- group_identity.logo_base64          the uploaded logo (PNG, JPEG or WebP,
--   / logo_type / logo_updated_at     at most 512 KB, checked by its bytes),
--                                     served at /brand/logo-<ms>.<ext>.
-- group_identity.setup_completed_at   when an admin finished the first-run
--                                     setup; NULL = Admin offers it.
--
-- One row at most (id = 1); no row = the brand JSON alone. An installation
-- that already has members is marked as set up, so its admins are not sent
-- through a first-run setup they do not need.
--
-- Additive: the code tolerates the table's absence (brand JSON alone), but
-- the anonymous stats endpoint reads it, so APPLY BEFORE DEPLOYING.
-- Idempotent.

CREATE TABLE IF NOT EXISTS group_identity (
  id integer PRIMARY KEY DEFAULT 1,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_base64 text,
  logo_type text,
  logo_updated_at timestamptz,
  setup_completed_at timestamptz,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL,
  CONSTRAINT group_identity_single_row CHECK (id = 1),
  CONSTRAINT group_identity_overrides_object CHECK (jsonb_typeof(overrides) = 'object'),
  CONSTRAINT group_identity_logo_type CHECK (logo_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT group_identity_logo_size CHECK (char_length(logo_base64) <= 700000),
  CONSTRAINT group_identity_logo_complete CHECK (
    (logo_base64 IS NULL AND logo_type IS NULL AND logo_updated_at IS NULL)
    OR (logo_base64 IS NOT NULL AND logo_type IS NOT NULL AND logo_updated_at IS NOT NULL)
  )
);
--> statement-breakpoint
INSERT INTO group_identity (id, overrides, setup_completed_at, updated_at, updated_by)
SELECT 1, '{}'::jsonb, now(), now(), 'migration'
WHERE EXISTS (SELECT 1 FROM members)
ON CONFLICT (id) DO NOTHING;
