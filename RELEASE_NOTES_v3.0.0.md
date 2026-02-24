# Cloud POS v3.0.0 — Configuration-Driven Architecture

## Release Date: February 24, 2026

Version 3.0.0 is the first major release of Cloud POS V3 — a complete architectural transformation from a hardcoded POS system to a **fully configuration-driven platform** built on Simphony-class design principles.

### Highlights

- **Configuration-Driven Architecture**: All POS behavior controlled through database flags instead of hardcoded logic
- **Tender Behavior Flags**: 7 behavioral columns (pop_drawer, allow_tips, allow_over_tender, print_check_on_payment, require_manager_approval, requires_payment_processor, display_order)
- **Tender Media Classification**: 3 flag columns (is_cash_media, is_card_media, is_gift_media) replace string matching in reports
- **RVC Print Configuration**: 5 columns for receipt/kitchen print modes, copies, void slips, guest count
- **OptionBits System**: Generic key-value flags with scope-based inheritance (Enterprise → Property → RVC → Workstation)
- **Service-Host Schema V4**: Full offline parity — SQLite mirrors cloud for tenders, RVCs, and option flags
- **Schema Verification CLI**: `verify-schema` command validates on-premise databases (6-section PASS/FAIL report)
- **CAPS Payment Enrichment**: Media flag classification in payment records
- **Cash Drawer Reliability**: Dual kick strategy, Star TSP100 compatibility, hex-dump diagnostics
- **Receipt Layout**: Professional formatting with bold headers, centered banners, clean separators
- **Non-Destructive Design**: All new flags default to false/null — existing enterprises unaffected

See `electron/RELEASE_NOTES_v3.0.0.md` for full details.
