## Why

Currently, `:config set` relies on an inline `_setConfigValue` closure passed through the TUI command context (`src/tui/app.js:58`) that delegates to private `assignPath` and `parseValue` helpers in `src/config/loader.js`. This tightly couples the command parser to the loader internals, makes testing difficult, and doesn't follow the pattern of treating config mutation as a first-class tool. Extracting this into a dedicated config tool makes the mutation logic reusable, testable, and consistent with the tool-based execution model used by skills.

## What Changes

- Extract config mutation logic from `src/config/loader.js` (`setConfigValue`, `assignPath`, `parseValue`) into a dedicated `src/config/mutate.js` module with its own public API.
- The config tool will deserialize `config.yaml` into a JS object, apply dot-path mutation, validate the patched object, serialize back to YAML, and write to disk — all in one composable pipeline.
- Update `src/tui/commandParser.js` to call the new config tool via `config.setValue` — no change to the dispatch mechanism or command signature.
- Keep `setConfigValue` in `loader.js` as a thin re-export from the new module for backward compatibility with `index.js`.
- Preserve all current behavior: dot-path support, type coercion (boolean/number/string), zod validation before persistence, and YAML round-trip.
- Update tests to cover the new module boundary.

## Capabilities

### New Capabilities
- `config-mutator`: A dedicated config mutation tool that deserializes, mutates, validates, serializes, and persists `config.yaml` — replacing the inline closure approach.

### Modified Capabilities
- `config-system`: Requirement "Runtime Config Mutation" — changes implementation from inline closure to dedicated config-mutator tool, no semantic behavior change.

## Impact

- **New**: `src/config/mutate.js` — config mutation tool module with `setConfigValueAt()`, `applyDotPathMutation()`, `parseValue()`, and `assignPath()` exports.
- **Modified**: `src/config/loader.js` — extract mutation helpers to `mutate.js`, re-export for backward compatibility.
- **Modified**: `src/tui/commandParser.js` — simplified (minor code reduction in config handler).
- **Unchanged**: `src/tui/app.js` — `config.setValue` interface contract stays the same.
- **Modified**: `tests/unit/config.test.js` — tests for loader adjusted.
- **New**: `tests/unit/config/mutate.test.js` — test suite for the config mutator tool.
