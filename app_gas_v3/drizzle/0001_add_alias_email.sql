-- Migration: add alias_email to members
-- Run this in the Neon console (or via drizzle-kit push)
ALTER TABLE members ADD COLUMN IF NOT EXISTS alias_email text;
