## Why

The searchFiles tool throws a ReferenceError/TypeError when `stdout` from the `execFile` call is undefined. The current code uses `stdout?.trim() ?? stdout` which evaluates to `undefined` when stdout is undefined, causing a subsequent TypeError on `output.split("\n")`. This breaks the searchFiles tool in edge cases where stdout is not a string.

## What Changes

- Replace `const output = stdout?.trim() ?? stdout;` with `const output = (stdout ?? "").trim();` in `src/tools/filesystem.js` line 436
- Ensure `output` is always a string before calling `split()`
- Handle undefined, null, and empty string cases for stdout gracefully

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
- `searchFiles`: Fix stdout handling to prevent ReferenceError when stdout is undefined

## Impact

- `src/tools/filesystem.js` — searchFilesImpl function (line 436)
- No API changes, no dependency changes
- Existing tests should continue to pass; the fix only changes error handling behavior