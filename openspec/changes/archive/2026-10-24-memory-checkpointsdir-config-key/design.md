## Context

The `memory.checkpointsDir` config key is declared in `config.yaml` and documented in the JSDoc of `src/session/checkpointer.js`, but it is silently stripped by the Zod `MemorySchema`. Because Zod strips unknown keys by default, `fullConfig.memory?.checkpointsDir` is always `undefined` and `createSqliteCheckpointer` always falls back to the hardcoded `"memory/checkpoints/"`. The config key is dead.

## Goals / Non-Goals

**Goals:**
- Make `memory.checkpointsDir` survive config validation so the checkpointer honors the configured directory.
- Add a regression test that locks in the behavior.

**Non-Goals:**
- No changes to persistence mode logic or the checkpointer factory dispatch.
- No changes to other memory config keys.
- No changes to the checkpointer's fallback behavior beyond what the schema fix enables.

## Decisions

**Decision: Add `checkpointsDir` to `MemorySchema` with a default matching the existing fallback.**

- The consumer (`src/session/checkpointer.js:58`) already reads `fullConfig.memory?.checkpointsDir || "memory/checkpoints/"`. The only barrier is that the schema strips the key before it reaches the consumer.
- Adding `checkpointsDir: z.string().default("memory/checkpoints/")` to `MemorySchema` is the minimal, surgical fix.
- The default `"memory/checkpoints/"` exactly matches the existing fallback, so configs that omit the key are behaviorally unchanged.
- **Alternative considered:** Modifying `checkpointer.js` to read the key from a different source. Rejected — the key already flows through `fullConfig.memory`; the schema was the only barrier, and the JSDoc already documents `fullConfig.memory.checkpointsDir`.

## Risks / Trade-offs

- [Default mismatch] → The default in the schema must match the existing fallback `"memory/checkpoints/"`. Verified against `checkpointer.js:58`.
- [Zod stripping] → Adding the key to the schema is the correct fix; no other config path needs changes.

## Migration Plan

No migration. This is a config-honoring fix with a backward-compatible default.

## Open Questions

None.
