## Why

The config module has two identical value-parsing functions (`_parseValue` in `src/config/loader.js` and `parseValue` in `src/config/patch.js`), a duplicated `DROPPED_KEYS` constant, and uses synchronous filesystem calls in `loadConfig`/`saveConfig`. This is a DRY violation and a maintenance hazard. This change consolidates the duplicated parser into a single shared helper and documents the two remaining findings as deliberate, correct decisions rather than forcing risky refactors.

## What Changes

- Extract the duplicated value-parsing logic into a single shared `parseValue` helper in `src/config/parse.js`.
- Replace the private `_parseValue` in `src/config/loader.js` with the shared helper.
- Re-export `parseValue` from `src/config/patch.js` for backward compatibility (named export, not wildcard).
- Document the decision to keep `loadConfig`/`saveConfig` synchronous (large blast radius, cached after first call).
- Document the decision to retain `structuredClone` in `applyDotPathMutation` (required for validate-before-mutate).
- Leave the `DROPPED_KEYS` casing and comparison semantics exactly as-is (the reported discrepancy is a false positive — changing it would break `SUB_AGENTS_TEMPERATURE_CODING`).

## Capabilities

### New Capabilities
- `config-loader-cleanup`: Consolidates duplicated config value-parsing logic into a single shared helper and documents the deliberate decisions to keep `loadConfig`/`saveConfig` synchronous and to retain `structuredClone` in `applyDotPathMutation`, without changing any config behavior.

### Modified Capabilities
<!-- No spec-level behavior changes. This is an internal refactor with no behavioral change. -->

## Impact

- `src/config/parse.js` — NEW shared `parseValue` helper.
- `src/config/loader.js` — import `parseValue`, remove private `_parseValue`; `DROPPED_KEYS` unchanged.
- `src/config/patch.js` — import and re-export `parseValue`.
- `tests/unit/config/patch.test.js`, `tests/unit/config/mutate.test.js` — verify `parseValue` still works via re-export.
- `tests/unit/config_loader.test.js` — verify loader still resolves env vars correctly.

## Non-goals

- Do NOT change the `DROPPED_KEYS` casing or comparison semantics.
- Do NOT make `loadConfig`/`saveConfig` async.
- Do NOT remove the `structuredClone` in `applyDotPathMutation`.
- Do NOT refactor unrelated config logic.
