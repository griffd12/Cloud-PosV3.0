# Cloud POS v3.1.18

## Release Date
March 2, 2026

## Summary
Fixes the sync thrashing bug where 5 stale offline operations retried every 5 seconds indefinitely, hammering the cloud server with 400/404 requests. Also fixes the service host configuration sync 500 error.

---

## Bug Fixes

### Sync Thrashing — Infinite Retry Loop (Critical)
- **Problem**: Background sync worker retried permanently-failed operations (400/404 responses from cloud) every 5 seconds indefinitely. SNS-001 had 5 stale operations with `offline_` prefixed IDs that will never succeed in the cloud.
- **Root Cause**: Two separate sync paths existed — `enhancedOfflineDb.syncToCloud()` and the legacy `syncOfflineData()` — both querying the same `offline_queue` table. Neither path had a retry limit, and neither classified 400/404 as permanent failures.
- **Fix**:
  - Added 10-retry maximum to **both** sync paths. Operations with `retry_count >= 10` are excluded from pending queries.
  - 400/404 HTTP responses are immediately classified as **permanent failures** (retry_count set to 10) — these are client errors that will never succeed on retry.
  - Transient failures (500, network errors) still get the full 10 retries before being shelved.

### Service Host Full Config Sync 500 Error
- **Problem**: Service host calling `/api/sync/config/full` received HTTP 500, preventing configuration sync for property SNS-001 Newport Beach.
- **Root Cause**: Two bugs in the server endpoint:
  1. Called `storage.getOrderDeviceKds()` — method doesn't exist; correct name is `getOrderDeviceKdsList()`
  2. Referenced `printClassRoutingTable` without importing the table from schema
- **Fix**: Corrected method name and added proper schema import.

---

## New Features

### Sync Queue Management (Admin/Debug)
- `getFailedOperations()` — returns all permanently-failed sync operations for inspection
- `getFailedOperationCount()` — returns count of permanently-failed operations
- `clearFailedOperations()` — marks permanently-failed operations as cleared (synced=2)
- `markOperationPermanentlyFailed(id, error)` — immediately marks an operation as permanently failed
- New IPC handlers:
  - `clear-failed-sync-ops` — clear all permanently-failed operations from the queue
  - `get-failed-sync-ops` — retrieve list of permanently-failed operations

---

## Files Changed
- `electron/offline-database.cjs` — retry limit, permanent failure classification, queue management methods
- `electron/main.cjs` — legacy sync path fixed with same retry limit and 400/404 handling, IPC handlers
- `server/routes.ts` — config sync endpoint method name and import fixes
- `electron/electron-builder.json` — version bump to 3.1.18

## Upgrade Notes
- **No breaking changes** — all changes are backward-compatible
- Existing stale sync operations will be permanently failed on first retry cycle after update
- Auto-updater will deliver this version to all connected workstations
