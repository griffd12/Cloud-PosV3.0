# Release Notes - v3.1.37

## Bug Fixes

### GREEN→YELLOW Check Continuity (Critical)
- Fixed checks created in GREEN mode disappearing when switching to YELLOW mode
- Added warm sync: after any successful check mutation in GREEN mode, the full check state (with items and payments) is now automatically pushed to CAPS via `/api/caps/sync/check-state`
- This ensures CAPS always has an up-to-date copy of active checks, enabling seamless failover to YELLOW mode

### Modifier Groups Sync Fix (Critical)
- Fixed `upsertModifierGroup` using wrong SQLite column names (`selection_type`, `min_selections`, `max_selections`) that don't exist in the schema
- Updated to use correct columns: `required`, `min_select`, `max_select`
- Fixed field mappings from cloud data: `mg.required` (boolean→int), `mg.minSelect`/`mg.minSelections`, `mg.maxSelect`/`mg.maxSelections`
- This fix applies to both the standalone service host (`database.ts`) and the embedded service host (`service-host-embedded.cjs`)
- All modifier data now syncs correctly to CAPS in YELLOW mode
