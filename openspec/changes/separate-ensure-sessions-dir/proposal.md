## Why

The `src/session/index.js` barrel file mixes re-exports with a standalone function (`ensureSessionsDir`). This violates the single-responsibility principle for barrel files — they should only re-export from other modules. Moving `ensureSessionsDir` to `factory.js` (where session creation logic lives) improves cohesion and makes the barrel file a clean, predictable re-export layer.

## What Changes

- Move `ensureSessionsDir` from `src/session/index.js` to `src/session/factory.js`
- Remove the export from `src/session/index.js`
- Update any consumers importing from the barrel

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None — structural refactoring with no spec-level behavior changes

## Impact

- Affected code: `src/session/index.js`, `src/session/factory.js`, any file importing `ensureSessionsDir` from the session barrel
- No API changes — function name and behavior preserved
- No dependency changes

## Non-goals

- Renaming any other files
- Changing the function's behavior or signature
- Restructuring other barrel files in the project
