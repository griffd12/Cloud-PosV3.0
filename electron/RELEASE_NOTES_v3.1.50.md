# Cloud POS v3.1.50 Release Notes

## Critical Fixes

### Offline UI Blank Screen Fix
- **CRITICAL:** App now serves its bundled frontend UI directly from packaged assets when the cloud server is unreachable
- Previously, the app tried to load the remote server URL even when offline, resulting in a blank screen or a dead-end "connect to internet" page
- New `serveBundledAsset()` function resolves `dist/public/` from the packaged app and serves HTML, JS, CSS, fonts, and images locally
- SPA route fallback handles `/`, `/pos`, `/kds` paths by serving `index.html`
- Bundled assets are checked after disk page cache, providing a reliable fallback chain: disk cache → bundled assets → offline fallback HTML

### SQLite Schema Fix: enterprises & privileges Tables
- Fixed `enterprises` and `privileges` tables missing the `enterprise_id` column in the CREATE TABLE schema
- Added both tables to the `migrateSchema()` enterprise_id migration list so existing deployed databases are automatically patched
- Eliminates the recurring sync errors: `table enterprises has no column named enterprise_id` and `table privileges has no column named enterprise_id`
- Full audit confirmed all other 40+ synced tables already have the correct schema

### Offline Sync Guard
- Periodic data sync (`syncFromCloud`) now checks `connectionMode === 'green'` before firing
- When in YELLOW or RED mode, sync is skipped with a single debug log line instead of attempting 56 API calls that all fail
- Eliminates log noise: previously produced 56 "fetch failed" or "HTTP 503" warnings per sync cycle when cloud was unreachable

## Version
- Electron app version: 3.1.50
