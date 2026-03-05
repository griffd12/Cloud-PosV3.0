# Cloud POS v3.1.35 Release Notes

**Release Date**: March 5, 2026  
**Build**: Electron Windows Installer  
**Commit**: b25a3610243ab9fff5db5284daee4ffef68d09ad

---

## Bug Fixes (7)

### Bug 1: Floating-Point Currency Rounding Errors in CAPS
- **Symptom**: Check totals could be off by one cent due to floating-point arithmetic accumulation
- **Root Cause**: `recalculateTotals()` in the CAPS service used raw JavaScript floating-point numbers for subtotal, tax, and total calculations instead of integer math
- **Fix**: Refactored all currency calculations to use integer cents math via the existing `toCents()`/`fromCents()` helpers. All intermediate values (subtotal, tax, discount, service charge, total, amount due) are computed as integers and only converted back to decimal for storage.
- **Files**: `service-host/src/services/caps.ts`

### Bug 2: Service Charge Routes Bypassed Centralized Total Recalculation
- **Symptom**: Adding or voiding a service charge did not update the check `total` field — only `serviceChargeTotal` and `taxTotal` were updated, leaving the balance incorrect until another action triggered a full recalculation
- **Root Cause**: The service charge add/void routes in `server/routes.ts` used inline manual calculation instead of the centralized `recalculateCheckTotals()` function used by all other routes
- **Fix**: Replaced inline calculation with `await recalculateCheckTotals(check.id)`. Also enhanced `recalculateCheckTotals()` to include service charge amounts and service charge tax in the check total, ensuring consistency with the inline logic it replaces.
- **Files**: `server/routes.ts`

### Bug 3: Item Availability Desync on Failed Add-Item
- **Symptom**: If adding an item to a check failed (network error, server error), the displayed stock quantity was permanently decremented in the UI until a page refresh or availability sync
- **Root Cause**: The optimistic `decrementQuantity()` call was not reverted in the `onError` handler of `addItemMutation` or the inline catch block in `handleSelectItem`
- **Fix**: Added a server-side `/api/item-availability/increment` endpoint (with corresponding `incrementItemAvailability` storage method) that reverses the decrement. Both error paths now call this endpoint to restore the correct count. The query cache is also invalidated to refresh availability data.
- **Files**: `client/src/pages/pos.tsx`, `server/routes.ts`, `server/storage.ts`

### Bug 4: Duplicate Journal Entries When Voiding Already-Voided Items
- **Symptom**: Voiding an item that was already voided created duplicate journal entries and triggered redundant total recalculations
- **Root Cause**: `voidItem()` in the CAPS service did not check whether the item was already voided before executing the update and writing a journal entry
- **Fix**: Added an early return (`if (item?.voided) return`) at the start of `voidItem()` to skip the operation when the item is already voided
- **Files**: `service-host/src/services/caps.ts`

### Bug 5: Check Lock Leak on Page Navigation
- **Symptom**: Navigating away from the POS page (browser back button, URL change, tab close) without explicitly logging out left the check locked for other workstations until the lock naturally expired (up to 5 minutes)
- **Root Cause**: No `beforeunload` handler or component cleanup was releasing the check lock on unmount
- **Fix**: Added a `useEffect` that registers a `beforeunload` event listener using `navigator.sendBeacon()` (with proper JSON content type) to release the lock even during page unload. The cleanup function also calls `releaseCurrentCheckLock()` on component unmount.
- **Files**: `client/src/pages/pos.tsx`

### Bug 6: Inactivity Logout During Active Payment
- **Symptom**: If a workstation had a short auto-logout timer configured, an employee could be logged out while waiting for a customer to provide payment (card tap, cash count), losing the transaction mid-flow
- **Root Cause**: The `useInactivityLogout` hook did not account for whether a payment modal was active
- **Fix**: Added `!showPaymentModal` to the `enabled` condition of the inactivity logout hook, pausing the timer whenever the payment modal is open
- **Files**: `client/src/pages/pos.tsx`

### Bug 7: Order Device Routing Wipe on Quick Save
- **Symptom**: Saving a workstation form before the order device routing data finished loading could wipe all existing routing assignments, sending orders to the wrong kitchen stations
- **Root Cause**: The `OrderDeviceRouting` component fetched existing assignments asynchronously, but `getSelectedIds()` returned an empty array before the fetch completed. If the user saved the form during this window, the empty array was submitted.
- **Fix**: Added a `routingLoaded` state and `isLoaded()` method to the routing component. The form's submit handler now checks `isLoaded()` and shows a "Please wait" message if routing data hasn't loaded yet.
- **Files**: `client/src/pages/admin/workstation-form.tsx`

---

## Files Modified
- `electron/electron-builder.json` — Version bump 3.1.34 → 3.1.35
- `electron/build-info.json` — Updated build metadata
- `service-host/src/services/caps.ts` — Integer cents math, void idempotency
- `server/routes.ts` — Service charge recalculation fix, item availability increment endpoint
- `server/storage.ts` — `incrementItemAvailability()` method
- `client/src/pages/pos.tsx` — Lock cleanup, availability rollback, inactivity guard
- `client/src/pages/admin/workstation-form.tsx` — Routing load guard
