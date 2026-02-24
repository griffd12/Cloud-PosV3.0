# Cloud POS Desktop v3.0.0

## Release Date: February 24, 2026

## Overview

Version 3.0.0 is the first major release of Cloud POS V3 — a complete architectural transformation from a hardcoded POS system to a **fully configuration-driven platform** built on Simphony-class design principles. Every behavioral aspect of the POS — from cash drawer kicks to receipt printing to tip prompts — is now controlled through database configuration flags rather than hardcoded logic. This release also delivers full offline parity between the cloud PostgreSQL database and the on-premise SQLite databases used by the Electron desktop app, the CAPS service-host, and the service-host schema verification tooling.

---

## Architecture: Configuration-Driven POS

### The Shift
Previously, POS behavior was determined by checking tender type strings in application code (e.g., `if (tender.type === 'cash') { openDrawer() }`). In V3.0, the application code reads **behavioral flags** from the database configuration. The `type` field is retained solely for display and labeling purposes.

### Design Principles
- All new boolean flags default to `false` — existing enterprises are never impacted by new features
- New text/integer config fields default to `null`
- Changes are strictly additive and non-destructive
- Configuration inheritance flows Enterprise → Property → Revenue Center → Workstation

---

## Tender Behavior Configuration

Tenders are no longer driven by hardcoded type strings. Seven new database columns provide per-tender behavioral control:

| Flag | Purpose |
|------|---------|
| `pop_drawer` | Triggers cash drawer kick on payment |
| `allow_tips` | Enables tip prompt for this tender |
| `allow_over_tender` | Enables change-due logic (overpayment) |
| `print_check_on_payment` | Controls automatic receipt printing on payment |
| `require_manager_approval` | Gates payment behind manager PIN authorization |
| `requires_payment_processor` | Indicates tender requires gateway communication |
| `display_order` | Controls tender button ordering on POS screen |

### Tender Media Classification

Three new flag columns replace string-based tender type matching in all reporting queries:

| Flag | Purpose |
|------|---------|
| `is_cash_media` | Identifies cash-type tenders for reporting |
| `is_card_media` | Identifies card-type tenders for reporting |
| `is_gift_media` | Identifies gift card tenders for reporting |

Canonical reporting DAL queries, Z Reports, Cash Drawer Reports, and Cashier Reports now join on these flag columns instead of matching `tender.type` strings.

---

## RVC Printing Configuration

Revenue Centers now support granular printing rules through five new columns:

| Flag | Purpose |
|------|---------|
| `receipt_print_mode` | `auto_on_close`, `auto_on_payment`, or `manual_only` |
| `receipt_copies` | Number of receipt copies to print |
| `kitchen_print_mode` | Supports `manual_only` for KDS-only sites |
| `void_receipt_print` | Toggle for automatic void slip printing |
| `require_guest_count` | Require guest count entry when opening checks |

---

## OptionBits Infrastructure (emc_option_flags)

A new generic key-value configuration system provides extensible behavioral flags with **scope-based inheritance**:

- **Table**: `emc_option_flags` with columns for enterprise_id, entity_type, entity_id, option_key, value_text, scope_level, scope_id
- **Inheritance**: Enterprise → Property → RVC → Workstation (most specific scope wins)
- **Runtime**: Batch loading via `server/config/optionBits.ts` with 60-second in-memory cache and `EffectiveConfig` accessor class
- **EMC UI**: Reusable `option-bits-panel.tsx` component with inherited value display, override toggle, and reset capability
- **API**: GET/PUT/DELETE `/api/option-flags` endpoints
- **Unique index**: Composite key on (enterprise_id, entity_type, entity_id, option_key, scope_level, scope_id)

---

## Service-Host Offline Parity (Schema V4)

The on-premise CAPS service-host SQLite schema has been upgraded to V4, achieving full parity with the cloud PostgreSQL database for configuration-driven features:

### Schema Changes
- **Tenders table**: 11 new columns (7 behavior + 1 display_order + 3 media flags)
- **RVCs table**: 5 new columns (print modes, copies, guest count)
- **emc_option_flags table**: New table with 3 indexes for scope-based resolution

### Migration Logic
- Automatic `ALTER TABLE` migration when V4 schema is detected
- **Backfill logic**: Existing tenders are automatically classified based on their type field:
  - Cash tenders: `is_cash_media=true`, `pop_drawer=true`, `allow_over_tender=true`
  - Card tenders: `is_card_media=true`, `allow_tips=true`
  - Gift tenders: `is_gift_media=true`

### Config Sync
- Cloud-to-local sync now includes `emcOptionFlags` in the full config response
- `syncMisc()` method processes and upserts option flags during sync
- New getter methods: `getTenders()`, `getRvcs()`, `getOptionFlags()`

### API Endpoints
- `GET /api/option-flags` — exposes EMC option flags from local SQLite

### CAPS Payment Enrichment
- Payment records in both `caps.ts` and `payment-controller.ts` now carry `isCashMedia`, `isCardMedia`, `isGiftMedia` flags
- Downstream reporting receives media classification without string matching

---

## Schema Verification CLI

A new `verify-schema` subcommand validates on-premise SQLite databases against the expected V4 schema:

```
node dist\index.js verify-schema --data-dir C:\POS\data
```

Produces a 6-section PASS/FAIL report:
- **Section A**: Tenders columns (all 11 new columns)
- **Section B**: RVCs columns (all 5 new columns)
- **Section C**: emc_option_flags table existence and columns
- **Section D**: Index proof with UNIQUE composite verification
- **Section E**: Backfill counts (cash/card/gift media, pop_drawer, allow_tips)
- **Section F**: Duplicate CREATE TABLE guard

Runs in read-only mode against the live database. No cloud connection required.

---

## Cash Drawer Reliability (from v1.4.12)

- **Dual kick strategy**: Embedded ESC/POS kick bytes in receipt data + standalone DRAWER_KICK WebSocket message as backup
- **ESC/POS command ordering**: Drawer kick fires BEFORE paper cut (printers discard data after cut)
- **Pin wiring correction**: Uses pin2 (0x00) for Cash Drawer 1
- **Workstation identification fix**: Proper `realWorkstationId` separation for accurate device routing
- **Multiple cash drawer support**: Two drawer outputs (pin2 and pin5) per workstation

## Cash Drawer Kick Enhancement (from v1.4.13)

- **Robust command sequence**: ESC @ (initialize) + BEL (Star Line Mode native) + ESC p (standard ESC/POS)
- Reliable on Star TSP100 printers in both Star Line Mode and ESC/POS emulation
- **Hex-dump logging**: Exact kick command bytes logged for diagnostics

---

## Receipt Layout Improvements (from v1.4.13)

- Bold double-height store name header
- Centered bold order type banner (e.g., TAKE OUT)
- Bold item names with indented modifiers
- Bold double-height total line
- Clean visual separators between sections
- Service charge and tip totals when applicable

---

## Upgrade Instructions

**Cloud Application**: No action required — changes deploy automatically.

**Windows Desktop (Electron)**:
1. Download `Cloud-POS-3.0.0-Setup.exe` from the GitHub Releases page
2. Run the installer — it will replace the existing installation automatically
3. The service-host database will auto-migrate to schema V4 on first launch
4. Run `verify-schema` to confirm migration: `node dist\index.js verify-schema --data-dir C:\POS\data`

**CAPS Service-Host**:
1. Deploy updated service-host binary
2. Database migration runs automatically on startup
3. Verify with: `node dist\index.js verify-schema --data-dir <data-dir>`
