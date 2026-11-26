# Proposal

## Why

The TUI contains three promise chains with no rejection handler: `gatherSystemInfo().then()` in `src/tui/systemPanel.js` (line 142) and two dynamic `import().then()` calls in `src/tui/app.js` (lines 311 and 332). When the underlying operation rejects, the rejection is unhandled, producing unhandled-rejection warnings or crashes. This is a code-quality defect identified by the review-code audit (grade C, 3 high findings).

## What Changes

- Add a `.catch()` to the `gatherSystemInfo()` chain in `src/tui/systemPanel.js` that handles the rejection gracefully and respects the existing `cancelled` flag.
- Add `.catch()` rejection handlers to both dynamic `import("../provider/copilotAuth.js").then(...)` chains in `src/tui/app.js` so a module-load failure is handled instead of producing an unhandled rejection.
- No public API, config, or behavior contract changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a defensive error-handling fix that does not change any spec-level behavior contract, so `skip_specs: true` is set in `.openspec.yaml`.

## Impact

- `src/tui/systemPanel.js` — add rejection handling to the system-info gather chain.
- `src/tui/app.js` — add rejection handling to the two Copilot auth dynamic-import chains.
- No dependencies, config, or external systems affected.

## Non-goals

- No changes to Copilot auth flow logic beyond adding rejection handling.
- No changes to the system-info gathering logic beyond error handling.
- No new public APIs or config surface.
