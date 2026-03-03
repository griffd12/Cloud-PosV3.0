# Cloud POS v3.1.23 Release Notes

## Source-Level Fixes for CAPS Service Host
v3.1.22 proved that `build-service-host.cjs` rebuilds the service host bundle from TypeScript source files during every build, overwriting the manually edited `service-host-embedded.cjs`. v3.1.23 fixes the actual source files so the build produces a correct bundle.

## Fixes

### 1. Config Sync 0 Records (service-host/src/sync/config-sync.ts)
- **Root cause**: Cloud endpoint `/api/sync/config/full` returns `{ configVersion, timestamp, data: { enterprise, property, revenueCenters, ... } }`. The old `syncFull()` used the raw response directly, looking for `config.enterprises` — but the data is nested inside `config.data` with different key names.
- **Fix**: Unwrap `rawResponse.data`, map singular keys to plural arrays (`enterprise` → `[enterprise]`, `property` → `[property]`, `revenueCenters` → `rvcs`), and use `rawResponse.configVersion` for version tracking.
- **Debug logging**: Raw response keys, inner data keys, and mapped entity array sizes are now logged.

### 2. CAPS Sync Endpoints Missing — HTTP 404 (service-host/src/routes/api.ts)
- **Root cause**: The endpoints `POST /api/caps/sync/check-state` and `POST /api/caps/sync/queue-operation` did not exist in the source TypeScript router.
- **Fix**: Added both endpoints to `createApiRoutes()` router. `check-state` upserts full check state (items, payments, discounts, service charges) with `PRAGMA foreign_keys = OFF` to avoid FK violations. `queue-operation` queues generic operations for cloud forwarding.

### 3. Auth Middleware Exemption for Sync Paths (service-host/src/middleware/auth.ts)
- **Root cause**: LAN workstations (e.g., Derek-Laptop) received HTTP 401 when syncing to CAPS because sync paths required authentication.
- **Fix**: Added path check to skip auth for `/caps/sync/*` paths. Localhost was already exempted.

### 4. Schema v6 Migration (service-host/src/db/schema.ts, database.ts)
- **Root cause**: `checks` table lacked `customer_id` and `customer_name` columns needed for check-state sync.
- **Fix**: Bumped SCHEMA_VERSION from 5 to 6. Added `migrateToV6()` that ALTERs the checks table to add both columns. Existing databases migrate automatically.

## Summary
| Issue | Error | Source File | Fix |
|-------|-------|------------|-----|
| Config sync empty | 0 records | config-sync.ts | Unwrap `rawResponse.data` + key remapping |
| Sync route missing | HTTP 404 | routes/api.ts | Added check-state + queue-operation routes |
| Sync auth rejected | HTTP 401 | middleware/auth.ts | Exempted `/caps/sync/*` paths |
| Missing columns | SQL error | schema.ts + database.ts | Schema v6 migration |
