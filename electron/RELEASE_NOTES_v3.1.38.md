# v3.1.38 - Comprehensive YELLOW Mode Fix

## Config Sync Fixes (Critical)

### Modifiers
- Fixed `upsertModifier`: removed non-existent `code` column, added missing `rvc_id` column
- Modifiers now sync correctly from cloud to CAPS SQLite database
- Fixed in both `database.ts` and `service-host-embedded.cjs`

### Print Classes
- Added missing `display_order` column to `print_classes` table schema
- Fixed `upsertPrintClass`: added missing `rvc_id` column
- KDS routing via print classes now syncs correctly

### Service Charges
- Added 5 missing columns to `service_charges` table: `apply_to_subtotal`, `apply_to_discounted`, `taxable`, `tax_group_id`, `auto_apply_guest_count`
- Service charges now sync correctly from cloud config

### Schema Migration
- Added v8 migration for existing databases (ALTER TABLE for print_classes and service_charges)
- Bumped schema version from 7 to 8

## Response Format Fixes (YELLOW Mode Operations)

### GET /checks/:id
- Changed from flat object to cloud-compatible format: `{ check: {..., paidAmount, tenderedAmount, changeDue}, items: [...], payments: [...], refunds: [] }`
- Checks now open correctly when tapped in YELLOW mode

### POST /checks/:id/items
- Changed from `{ items: [...] }` to single item object with 201 status (matches cloud)

### POST /checks/:id/send
- Changed from `{ roundNumber, itemsSent, tickets }` to `{ round, updatedItems }` (matches cloud)
- Items now show as sent after kitchen send in YELLOW mode

### POST /checks/:id/payments
- Changed from returning payment object to returning check spread with `paidAmount` (matches cloud)
- Auto-closes check when fully paid (matches cloud behavior)
- Frontend payment flow now works correctly in YELLOW mode

### POST /checks/:id/reopen
- Fixed: now actually writes to database (`UPDATE checks SET status = 'open'`)
- Previously only modified in-memory object, DB still showed closed
- Returns `{ success: true, check }` matching cloud format
- Added `reopenCheck` method to CAPS engine

### POST /checks/:id/split
- Changed from `{ success: true, newCheckId }` to `{ sourceCheck: { check, items }, newChecks: [...] }` (matches cloud)

## New Routes
- Added `POST /checks/:id/service-charges` for applying service charges in YELLOW mode

## Files Changed
- `service-host/src/db/schema.ts`
- `service-host/src/db/database.ts`
- `service-host/src/services/caps.ts`
- `service-host/src/routes/api.ts`
- `electron/service-host-embedded.cjs`
- `electron/electron-builder.json`
