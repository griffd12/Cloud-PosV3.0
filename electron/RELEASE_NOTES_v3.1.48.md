# v3.1.48 — Config Sync: Full EMC Coverage + Stale Data Fix

## Bug Fix: Price/Config Changes Not Propagating to Electron POS

**Root cause**: `hasConnectedBeforeRef` was a component-level `useRef(false)` that reset on every POS page mount. Combined with `staleTime: Infinity`, this meant:
- Every login was treated as a "first connect" (no catch-up invalidation)
- React Query cache persisted stale data indefinitely across logouts/logins
- Config updates missed while logged out were never recovered

**Fix**:
- Changed `hasConnectedBeforeRef` to module-level `hasEverConnected` variable — persists across component mounts so every login after the first triggers full config cache invalidation
- Changed Electron `staleTime` from `Infinity` to 5 minutes — safety net ensuring data refreshes even if a WebSocket config_update is missed
- Added `invalidateByPrefix` with predicate-based matching — handles query-string keys like `/api/break-rules?propertyId=...` that standard prefix matching misses

## Full EMC Config Broadcast Audit

Audited all 121 config mutation routes. Added missing `broadcastConfigUpdate` calls to 18 routes:

**Job Codes** (3 routes): POST/PATCH/DELETE `/api/job-codes`
**Tip Pool Policies** (3 routes): POST/PATCH/DELETE `/api/tip-pool-policies`
**Tip Rules** (4 routes): POST/PATCH/DELETE `/api/tip-rules` + PUT percentages
**Overtime Rules** (3 routes): POST/PATCH/DELETE `/api/overtime-rules`
**Break Rules** (3 routes): POST/PATCH/DELETE `/api/break-rules`
**Seed Routes** (2 routes): POST `/api/privileges/seed` + `/api/roles/seed`

## Frontend Category Mapping

Added categories to `CATEGORY_TO_QUERY_KEYS`:
- `tip_pool_policies` → `/api/tip-pool-policies`, `/api/tip-pool-runs`
- `tip_rules` → `/api/tip-rules`, `/api/tip-rules/property`
- `overtime_rules` → `/api/overtime-rules`
- `break_rules` → `/api/break-rules`

## Files Changed
- `client/src/hooks/use-config-sync.ts` — module-level `hasEverConnected`, new category mappings, predicate-based prefix invalidation
- `client/src/lib/queryClient.ts` — Electron staleTime: `Infinity` → `5 * 60 * 1000`
- `server/routes.ts` — 18 missing `broadcastConfigUpdate` calls added
- `electron/electron-builder.json` — version bump to 3.1.48
