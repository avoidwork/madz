## Why

`src/tools/shell.js` at 257 lines is the largest file in the tools directory, mixing two distinct responsibilities: shell command execution (foreground/background) and background process management (tracking, polling, killing, pausing, resuming). This violates single-responsibility principles and makes both concerns harder to maintain. Splitting into `shell.js` and `process.js` gives each concern its own file.

## What Changes

- Extract process management code into `src/tools/process.js`
- Keep shell execution code in `src/tools/shell.js` (reduced to ~100 lines)
- Update `src/tools/index.js` to export from both files
- Update all consumers importing from `shell.js`

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None — structural refactoring with no spec-level behavior changes

## Impact

- Affected code: `src/tools/shell.js`, `src/tools/process.js` (new), `src/tools/index.js`, any file importing from `shell.js`
- No API changes — function names and behavior preserved
- No dependency changes

## Non-goals

- Adding new process management actions
- Changing shell execution behavior
- Restructuring other tool files
