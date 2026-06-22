## Why

The audit-code scan identified five precision issues in `./src/config` that introduce crash risks, state divergence, dead code, and missing input validation. These are not new features — they are fixes to eliminate specific failure modes that can corrupt state or crash the application on startup.

## What Changes

- **loader.js:** Wrap `yaml.load()` in try/catch; fall back to `DEFAULT_CONFIG` on parse failure
- **loader.js:** Reverse mutation/persist order in `setConfigValue()` — persist first, mutate second; throw on write failure without mutating memory
- **loader.js:** Remove duplicate `_parseValue()`, import `parseValue` from `mutate.js` instead
- **schemas.js:** Remove three dead provider schemas (`_OpenaiProviderConfigSchema`, `_OpenrouterProviderConfigSchema`, `_FalProviderConfigSchema`)
- **mutate.js:** Add object guard to `assignPath()` — throw descriptive Error for null/undefined/non-object inputs
- **Tests:** Add tests for malformed YAML fallback, assignPath guard, and setConfigValue memory preservation

## Capabilities

### New Capabilities
<!-- None — this is a pure fix change -->

### Modified Capabilities
<!-- None — no spec-level requirement changes, only implementation fixes -->

## Impact

- **Files modified:** `src/config/loader.js`, `src/config/mutate.js`, `src/config/schemas.js`
- **Files added:** Test cases for new behavior
- **Breaking changes:** None. All fixes preserve existing behavior for valid inputs.
- **Risk:** Low. Each fix is isolated to a single function. No API changes.