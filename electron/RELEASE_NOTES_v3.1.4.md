# Cloud POS v3.1.4 — Offline Mode Complete Fix

**Release Date:** February 2026
**Build Target:** Windows x64 (NSIS Installer)
**Previous Version:** v3.1.3

---

## Summary

Comprehensive fix for the Electron app's offline functionality. The app now works 100% in all three connection modes: Green (Cloud), Yellow (CAPS), and Red (Standalone). Previously, when internet dropped, the app would freeze for 30-120 seconds and users couldn't sign in or ring transactions until internet returned.

---

## What's Fixed

### 1. App No Longer Freezes When Internet Drops (Critical)
- **Root Cause**: The protocol interceptor's cloud fetch had NO timeout. When internet dropped, every request (pages, logins, API calls) hung for 30-120 seconds waiting for Windows TCP timeout.
- **Fix**: Added 8-second timeout (`AbortSignal.timeout(8000)`) to all cloud fetch attempts. Requests now fail over to CAPS (Yellow) or local SQLite (Red) within 8 seconds.

### 2. Pages Load Instantly When Offline (Critical)
- **Root Cause**: When already known offline, non-API requests (HTML, JS, CSS) still attempted cloud fetch before falling back to disk cache, adding unnecessary delay.
- **Fix**: When `isOnline` is false, cached pages are served from disk FIRST before attempting any cloud fetch. The POS UI loads instantly in offline mode.

### 3. Offline Check Totals Now Correct (High)
- **Root Cause**: `addOfflineCheckItem` only calculated `subtotal` but never updated `taxTotal` or `total`. The `total` field stayed at `$0.00`, causing the payment handler to think every check was fully paid with any payment amount.
- **Fix**: After adding items, the system now looks up cached tax rates and calculates tax. Total = subtotal - discounts + tax. If no tax data is cached, total falls back to subtotal.

### 4. Missing Heartbeat Handler Added (Medium)
- **Root Cause**: `POST /api/registered-devices/heartbeat` had no offline handler, causing 503 errors in logs during offline operation.
- **Fix**: Added handler that returns a 200 acknowledgment when offline.

### 5. Faster Offline Recovery Detection (Low)
- **Root Cause**: Connectivity check ran every 30 seconds regardless of mode, meaning it could take up to 30 seconds to detect when internet came back.
- **Fix**: When in Yellow or Red mode, connectivity check interval is reduced to 15 seconds. Returns to 30 seconds when back to Green.

---

## Connection Mode Overview

| Mode | Color | Meaning | Capabilities |
|------|-------|---------|--------------|
| Green | Online | Connected to Cloud | Full POS operations |
| Yellow | CAPS | Cloud down, CAPS reachable | Full POS via local CAPS server |
| Red | Standalone | Cloud + CAPS unreachable | Core POS from local SQLite |

### Red Mode (Standalone) Capabilities:
- PIN login (cached employee data)
- Create checks, add items, send orders
- Process cash payments, store-and-forward card payments
- Tax calculation from cached rates
- Clock in/out
- Print job queuing

### Red Mode Limitations:
- Gift cards and loyalty (require global balance)
- Manager approval (requires real-time validation)
- Remote printing (no network)

### Sync Flow:
All offline transactions queue locally and sync automatically when connectivity returns: Standalone → CAPS → Cloud.

---

## Upgrade Notes

- Manual install required (auto-updater needs GitHub token for private repo).
- No configuration changes needed.
- After update, disconnect internet to test: app should transition to Red mode within 8 seconds and remain fully operational.
