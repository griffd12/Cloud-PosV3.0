-- Migration: Add tender media classification flag columns
-- Purpose: Dedicated boolean columns for high-frequency media type checks in SQL JOINs and reporting
-- Date: 2026-02-24
-- Phase: OptionBits - tender media flags

ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_cash_media boolean DEFAULT false;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_card_media boolean DEFAULT false;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_gift_media boolean DEFAULT false;

-- Backfill from existing type column
UPDATE tenders SET is_cash_media = true WHERE type = 'cash';
UPDATE tenders SET is_card_media = true WHERE type IN ('credit', 'debit');
UPDATE tenders SET is_gift_media = true WHERE type = 'gift';
