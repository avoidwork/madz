## Why

`src/logger.js` is an orphaned cross-cutting logging utility sitting at the root of `./src/` alongside 12 subdirectories. It does not belong at the root level and creates a disorganized codebase structure. Moving it into `src/shared/` improves cohesion and aligns with the project's modular architecture.

## What Changes

- Create `src/shared/` directory
- Move `src/logger.js` → `src/shared/logger.js` (file content unchanged)
- Update all import paths referencing `./src/logger.js` to `./src/shared/logger.js` (or appropriate relative path)
- No API surface changes — logger module behavior remains identical

## Capabilities

### New Capabilities
- `src-shared`: Defines `src/shared/` as a new top-level module directory for cross-cutting utilities

### Modified Capabilities
- None — this is a pure refactoring with no behavioral changes

## Impact

- All files importing from logger.js must update their import paths
- No breaking changes to public APIs
- No new dependencies

## Non-goals

- Modifying logger.js internals or adding new logging functionality
- Changing the logger's API surface
- Creating a barrel index (`index.js`) in `src/shared/` — logger.js is the only file there
