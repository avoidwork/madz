## Why

The sandbox runner in `src/sandbox/runner.js` calls `enforceCapabilities()` to map skill permissions to resource access rules, but the result is stored in an unused `_rules` variable and never applied to the spawned child process. This means sandbox permissions are declared but never actually enforced, creating a security gap where spawned processes have unrestricted access.

## What Changes

- Apply the `resources` array returned by `enforceCapabilities()` to the spawned child process via Node.js `--permission` flag
- Change `_rules` to `resources` in `src/sandbox/runner.js` line 125 to reflect actual usage
- Add `--permission` flag to `execArgv` when spawning Node.js scripts with non-empty permissions
- Add test to verify permissions are actually applied to the spawned process

## Capabilities

### New Capabilities
<!-- No new capabilities — this is a bug fix -->

### Modified Capabilities
- `sandbox-runner`: Requirement changed — spawned processes must now have capabilities enforced via `--permission` flag based on skill permissions

## Impact

- `src/sandbox/runner.js` — `runSandbox()` function, line 125
- `src/sandbox/capability.js` — `enforceCapabilities()` function (no changes, but referenced)
- `tests/unit/sandbox.test.js` — existing sandbox runner tests
- Only affects Node.js script execution (python, bash, ruby, etc. are unaffected)
- Requires Node.js v20.0+ for `--permission` flag support