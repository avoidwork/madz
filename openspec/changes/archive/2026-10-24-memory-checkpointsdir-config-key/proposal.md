## Why

The `memory.checkpointsDir` config key in `config.yaml` is silently stripped by the Zod `MemorySchema`, so `fullConfig.memory?.checkpointsDir` is always `undefined` and the checkpointer always falls back to the hardcoded `"memory/checkpoints/"`. The documented config key is dead — changing it has no effect.

## What Changes

- Add `checkpointsDir` to `MemorySchema` in `src/config/schemas/memory.js`, defaulting to `"memory/checkpoints/"`.
- Ensure `loadConfig().memory.checkpointsDir` returns the configured value (not `undefined`).
- Add a regression test asserting the key is preserved and defaults correctly.
- No change to `src/session/checkpointer.js` — it already reads `fullConfig.memory?.checkpointsDir`; the schema was the only barrier.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `checkpointer`: The checkpointer SHALL honor the configured `memory.checkpointsDir` so checkpoint data is written to the configured directory rather than always falling back to the hardcoded default.

## Impact

- **Code**: `src/config/schemas/memory.js` (add key to schema), `tests/unit/config/schemas/memory.test.js` (new regression test).
- **Config**: `config.yaml` already contains `checkpointsDir: memory/checkpoints/` at line 114.
- **Behavior**: Configs that set a custom `memory.checkpointsDir` will now have it honored. Configs that omit the key are unchanged (default matches the existing fallback).

## Non-goals

- No changes to persistence mode logic or the checkpointer factory dispatch.
- No changes to other memory config keys.
- No changes to the checkpointer's fallback behavior beyond what the schema fix enables.
