# Cloud POS v3.1.1 — Service-Host Hotfix

**Release Date:** February 2026  
**Build Target:** Windows x64 (NSIS Installer)  
**Previous Version:** v3.1.0

---

## Summary

Hotfix for a critical bug where the CAPS workstation (WS01) could not start the embedded service-host process, preventing Yellow mode (LAN-based offline operations) from functioning.

---

## What's Fixed

### Service-Host Shebang Crash (Critical)
- **Root Cause**: The esbuild-bundled `service-host-embedded.cjs` contained a `#!/usr/bin/env node` shebang line from the source entry point. When Electron's `fork()` loaded this file from inside the `.asar` archive, Node's module loader could not parse the shebang, causing `SyntaxError: Invalid or unexpected token` at line 14 and a crash loop with 5-second restarts.
- **Fix**: Build script now strips all shebang lines from the bundle output before prepending the env bootstrap. Additionally, the service-host bundle is now added to `asarUnpack` so it's extracted outside the asar archive, ensuring `fork()` works reliably with native modules.
- **Impact**: CAPS workstations can now start the embedded service-host process successfully, enabling Yellow mode for all workstations on the LAN when internet drops.

### COM Panel on Custom POS Layouts
- The Conversational Ordering Module (COM / Menu Build) panel now renders correctly on both custom grid layouts and standard SLU layouts.
- Previously, tapping a menu-build-enabled item on a custom grid layout did nothing — the COM panel was only wired to the standard SLU branch.

### EMC Menu Build Multi-Select
- The "Add Ingredient from Modifiers" UI in the Menu Items EMC form now uses multi-select checkboxes instead of a single-select dropdown.
- Modifiers are grouped by their modifier group (e.g., "Ice Cream Flavor", "Toppings", "Drizzles") with section headers.

### CI/CD Fix
- GitHub Actions workflow updated to use the built-in `GITHUB_TOKEN` instead of a personal access token for the release step.
- Eliminates "Bad credentials" failures when the personal token expires.

### Token Leak Prevention
- `.replit` and `.local/` added to `.gitignore` to prevent environment tokens from being committed to the repository.

---

## Upgrade Notes

- Auto-update from v3.1.0 will apply automatically on all workstations.
- No configuration changes needed.
- After update, WS01 should successfully start the service-host on port 3001 (verify in logs).

---

## Known Limitations

- Service-host embedded bundle requires `better-sqlite3` native module (already included in Electron build).
- Yellow mode requires LAN connectivity between workstations.
- First boot requires internet to fetch activation-config (cached thereafter).
