# Cloud POS v3.1.52 Release Notes

## Critical Bug Fixes

### Fix CAPS addItems total_price NOT NULL constraint failure
- Hardened the `addItems()` price computation to guarantee `totalPrice` is always a valid integer
- Now accepts `unitPrice` from frontend in addition to `priceOverride` and `menuItem.price`
- Falls back to 0 with a warning log if price computation produces NaN/undefined
- Eliminates the `NOT NULL constraint failed: check_items.total_price` error in YELLOW mode

### Fix CAPS service-charges endpoint returning 500
- Added missing `voided` column to `check_service_charges` table schema
- Added migration fixup to add `voided` column to existing databases
- `GET /api/checks/:id/service-charges` now returns 200 in YELLOW mode

### Fix CAPS /api/health returning 404
- Added explicit `/api/health` route at the app level
- YELLOW mode health checks now return 200 instead of falling back to RED mode

### Add CAPS item-availability/increment endpoint
- Added `POST /api/item-availability/increment` route handler
- Frontend availability rollback now works correctly in YELLOW mode

## Technical Details
- All fixes applied to BOTH `service-host-embedded.cjs` (CJS runtime) AND TypeScript source files
- Version bump: 3.1.51 → 3.1.52
