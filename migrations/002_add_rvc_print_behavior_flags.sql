-- Migration: Add print/receipt behavioral configuration columns to rvcs table
-- Purpose: Move print behavior from hardcoded logic to RVC-level configuration
-- Date: 2026-02-23
-- Phase: Print config-driven refactor (Phase 2)

-- receipt_print_mode: Controls when receipts auto-print
--   'auto_on_close' = print automatically when check closes (default, legacy behavior)
--   'auto_on_payment' = print after each payment applied
--   'manual_only' = never auto-print, only on explicit reprint request
--
-- receipt_copies: Number of receipt copies to print (default 1)
--
-- kitchen_print_mode: Controls when kitchen tickets fire
--   'auto_on_send' = fire when items are sent to kitchen (default, legacy behavior)
--   'manual_only' = only print kitchen tickets on explicit request
--
-- void_receipt_print: Whether to auto-print a void slip when items are voided (default true)
--
-- require_guest_count: Whether to require guest count before opening a check (default false)

ALTER TABLE rvcs
  ADD COLUMN IF NOT EXISTS receipt_print_mode text DEFAULT 'auto_on_close',
  ADD COLUMN IF NOT EXISTS receipt_copies integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kitchen_print_mode text DEFAULT 'auto_on_send',
  ADD COLUMN IF NOT EXISTS void_receipt_print boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_guest_count boolean DEFAULT false;
