-- Migration to add tokenVersion to user and useradmin tables
-- Needed for the unified session management refactor

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0;
ALTER TABLE "useradmin" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0;
