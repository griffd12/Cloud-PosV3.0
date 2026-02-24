# Cloud POS Desktop v1.4.13

## Release Date: February 22, 2026

### Cash Drawer Kick Reliability Fix
- **Robust drawer kick command sequence**: Now sends ESC @ (initialize) + BEL (Star Line Mode native) + ESC p (standard ESC/POS) for both standalone and embedded receipt kicks
- Ensures cash drawer fires reliably on Star TSP100 printers regardless of whether they are in Star Line Mode or ESC/POS emulation mode
- ESC @ initialization ensures the printer is in a clean, ready state before processing drawer commands
- BEL (0x07) provides Star-native drawer kick fallback for printers not responding to ESC p through Windows Print Spooler

### Enhanced Drawer Kick Logging
- Hex dump of exact kick command bytes logged for every drawer kick attempt
- Print agent now scans embedded receipt data for both BEL and ESC p kick commands with detection counts
- Verbose printer name, connection type, and send attempt/completion details in all kick logs
- Improved diagnostic output to trace drawer kick failures on Windows workstations

### Receipt Layout (Server-Side)
- Professional receipt formatting with bold double-height store name header
- Order type displayed as centered bold banner (e.g., TAKE OUT)
- Item names printed in bold with modifiers indented below
- Total line in bold double-height for visibility
- Clean visual separators between receipt sections
- Service charge and tip totals shown when applicable
