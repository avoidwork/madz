## Why

The `src/tui` module contains redundant re-exports that add no value: `hooks.js` re-exports `nextPanel` and `prevPanel` from `panels.js` with no added logic, and `components.js` re-exports 7 components that are also re-exported via `index.js`. These dead re-exports increase cognitive load and maintenance burden for no benefit.

## What Changes

- Remove `nextPanel` and `prevPanel` from `src/tui/hooks.js`
- Update consumers to import from `panels.js` directly
- Check if `src/tui/components.js` is imported anywhere; remove or merge into `index.js`

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None — structural cleanup with no spec-level behavior changes

## Impact

- Affected code: `src/tui/hooks.js`, `src/tui/components.js`, `src/tui/index.js`, any file importing from hooks.js or components.js
- No API changes — function names preserved, just import paths change
- No dependency changes

## Non-goals

- Renaming any TUI modules
- Changing TUI behavior or component logic
- Restructuring other directories
