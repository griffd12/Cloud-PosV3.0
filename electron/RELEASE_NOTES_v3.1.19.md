# Cloud POS v3.1.19 Release Notes

## Critical Bug Fixes

### B1: Check Number Collision After Cloud Sync
- **Problem**: Creating a new check failed with `UNIQUE constraint failed: offline_checks.rvc_id, offline_checks.check_number` when synced checks from cloud had check numbers that collided with the local `rvc_counters` starting value.
- **Fix**: Added `updateCheckCountersAfterSync()` — after syncing checks from cloud, `rvc_counters` is updated to `MAX(check_number) + 1` for each RVC. Also added collision retry logic (up to 3 attempts) in `createCheckAtomic()` that automatically recovers from any remaining UNIQUE constraint violations.

### B2: Save Payment Fails — Missing `data` Column
- **Problem**: `saveOfflinePayment()` crashed with `table offline_payments has no column named data` on databases created by older versions.
- **Fix**: Added `{ table: 'offline_payments', column: 'data', type: 'TEXT' }` to `additionalMigrations` so existing databases get the column added on startup.

### B3/B4: Missing `data` Column on offline_checks and offline_check_items
- **Problem**: Same pattern as B2 — `offline_checks` and `offline_check_items` tables created by older versions were missing the `data` column.
- **Fix**: Added migration entries for both tables to `additionalMigrations`.

### B5: Service Host Config Sync Returns 0 Records
- **Problem**: The CAPS service host config sync endpoint returned 200 but parsed 0 records because the response structure didn't match what the sync methods expected:
  - Data was nested under `response.data` but sync methods read from the top level
  - Server used singular names (`enterprise`, `property`) but sync expected plural (`enterprises`, `properties`)
  - Server used `revenueCenters` but sync expected `rvcs`
  - `configVersion` field not mapped to `version`
- **Fix**: Added response unwrapping in `syncFull()` that extracts `rawResponse.data`, normalizes singular-to-plural naming, maps `revenueCenters` to `rvcs`, and correctly reads `configVersion`.

### B6: Employee PINs Missing from Config Sync
- **Problem**: The `/api/sync/config/full` endpoint stripped `pinHash` from employee records, breaking offline PIN-based authentication in YELLOW/RED modes.
- **Fix**: Removed the `pinHash: undefined` mapping so employee PIN data syncs to the service host for offline auth.

## Impact
- All POS write operations (create check, payments, items, modifiers, discounts, voids, cancels, transfers, reopens, splits) now work reliably in GREEN, YELLOW, and RED modes
- CAPS service host correctly receives and stores all configuration data for YELLOW mode failover
- Offline authentication works with synced employee PINs

## Files Changed
- `electron/offline-database.cjs` — Migration fixes, check counter sync, collision retry
- `electron/service-host-embedded.cjs` — Config sync response parsing fix
- `server/routes.ts` — Include employee PINs in config sync response
- `electron/electron-builder.json` — Version bump to 3.1.19
