# Proposal

## Why

Three promise chains in the TUI layer lack rejection handlers, so when an asynchronous operation fails (system info gathering, dynamic import of the Copilot auth module) the rejection is unhandled. Unhandled rejections can crash the Node.js process or pollute the console with noisy errors, degrading the interactive terminal experience.

## What Changes

- Add a `.catch()` rejection handler to the `gatherSystemInfo().then(...)` chain in `src/tui/systemPanel.js`, preserving the `cancelled` guard in the success handler and not calling `setInfo` on rejection.
- Add a `.catch()` rejection handler to the dynamic `import("../provider/copilotAuth.js").then(...)` chain in the 401 re-auth handler effect in `src/tui/app.js`, preserving the `disposed` guard.
- Add a `.catch()` rejection handler to the dynamic `import("../provider/copilotAuth.js").then(...)` chain in the same effect's cleanup function in `src/tui/app.js`, preserving the generation-counter guard.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-system-panel`: Add a requirement that the SystemPanel SHALL handle promise rejections from `gatherSystemInfo()` without emitting an unhandled rejection, while preserving the cancelled/disposed guard.
- `github-copilot-provider`: Add a requirement that the 401 re-auth handler registration and cleanup in the TUI app SHALL handle dynamic-import rejections without emitting an unhandled rejection, while preserving the disposed/generation guards.

## Non-goals

- No change to the success-path control flow or the `cancelled`/`disposed`/generation guards.
- No change to the system info gathering logic or the Copilot auth flow itself.
- No new UI surface or user-visible behavior change beyond eliminating unhandled rejections.

## Impact

- `src/tui/systemPanel.js`
- `src/tui/app.js`
- No new dependencies.
