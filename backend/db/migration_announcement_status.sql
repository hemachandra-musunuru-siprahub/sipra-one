-- ============================================================
-- Migration: Add status column to announcements table
-- Run this in the Supabase SQL Editor manually.
-- ============================================================

-- Step 1: Add the status column (safe - idempotent)
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published';

-- Step 2: Backfill existing rows to 'published'
UPDATE announcements
SET status = 'published'
WHERE status IS NULL OR status = '';

-- Step 3: Add constraint to allow only valid values
ALTER TABLE announcements
DROP CONSTRAINT IF EXISTS announcements_status_check;

ALTER TABLE announcements
ADD CONSTRAINT announcements_status_check
CHECK (status IN ('draft', 'published'));

-- Step 4: Index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);

-- Verify:
-- SELECT id, title, status FROM announcements LIMIT 10;
