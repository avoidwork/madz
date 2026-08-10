## Why

The file `src/memory/expireEphemeral.js` exports the function `expireEphemeralMemories` but the filename doesn't match the function name. This naming inconsistency creates confusion for developers navigating the codebase and violates the convention that filenames should reflect their primary export.

## What Changes

- Rename `src/memory/expireEphemeral.js` → `src/memory/expireEphemeralMemories.js`
- Update import path in `src/memory/context.js`
- Update export in `src/memory/index.js`

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None — this is a pure refactoring with no spec-level behavior changes

## Impact

- Affected code: `src/memory/expireEphemeral.js`, `src/memory/context.js`, `src/memory/index.js`
- No API changes — function name and behavior preserved
- No dependency changes

## Non-goals

- Renaming any other files in the memory module
- Changing the function's behavior or signature
