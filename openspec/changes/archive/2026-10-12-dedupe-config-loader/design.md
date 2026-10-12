## Context

The config module (`src/config/`) has accumulated duplication and fragile constants. The issue (#1378) lists four findings. Three are genuine; one is a false positive. This design documents the technical decisions for the genuine findings and explicitly documents why the false positive and two borderline findings are left as-is.

The relevant files:
- `src/config/loader.js` — `loadConfig`, `saveConfig`, `_parseValue`, `_resolveEnvRecursively`, module-level `DROPPED_KEYS`.
- `src/config/patch.js` — `parseValue`, `assignPath`, `applyDotPathMutation` (uses `structuredClone`).

## Goals / Non-Goals

**Goals:**
- Consolidate the duplicated value-parsing logic (`_parseValue` in `loader.js` and `parseValue` in `patch.js`) into a single shared helper.
- Document the decision to keep `loadConfig`/`saveConfig` synchronous.
- Document the decision to retain `structuredClone` in `applyDotPathMutation`.
- Preserve all existing config behavior exactly.

**Non-Goals:**
- Do NOT change the `DROPPED_KEYS` casing or comparison semantics (false positive).
- Do NOT make `loadConfig`/`saveConfig` async.
- Do NOT remove the `structuredClone` in `applyDotPathMutation`.
- Do NOT refactor unrelated config logic.

## Decisions

### Decision 1: Extract a shared `parseValue` helper

**Rationale:** `_parseValue` in `loader.js` and `parseValue` in `patch.js` are byte-for-byte identical. This is a genuine DRY violation. Extract to `src/config/parse.js` and import in both.

**Alternatives considered:**
- Keep both and accept the duplication — rejected, violates AGENTS.md §1.4 (DRY).
- Export `parseValue` from `patch.js` and import it into `loader.js` — rejected because `loader.js` already imports from `patch.js` (`applyDotPathMutation`), and importing a value-parser from a mutation module creates an awkward dependency direction. A dedicated `parse.js` is cleaner and has no imports, so no circular-dependency risk.

**Backward compatibility:** `patch.js` re-exports `parseValue` as a named export (not a wildcard, per AGENTS.md §1.1) so existing consumers and tests (`tests/unit/config/patch.test.js`, `tests/unit/config/mutate.test.js`) continue to work unchanged.

### Decision 2: Keep `loadConfig`/`saveConfig` synchronous

**Rationale:** `loadConfig()` is called synchronously at module level in ~30 files (e.g. `const cwd = loadConfig().cwd` in `src/memory/context.js`, `src/session/loader.js`, `src/tools/scanAgents/index.js`, `src/agent/deepAgents.js`, etc.). Making it async would require converting all of these call sites — a very large, risky blast radius with no functional benefit. It is cached after the first call (`cachedConfig`), so the blocking `readFileSync` is a one-time hit at startup.

`saveConfig()` is called via `setConfigValue` → `_setConfigValue` → the synchronous `parse()`/command-handler chain in `src/tui/conversationArea.js` and `src/tui/commandParser.js`. Converting it to async would require propagating async through the synchronous command dispatch, which is a large change.

**Alternatives considered:**
- Convert `loadConfig` to async — rejected: ~30 module-level sync call sites, high risk, no functional benefit.
- Convert `saveConfig` to async — rejected: requires async propagation through the synchronous TUI command handler chain.
- Keep sync and document — accepted: the one-time blocking hit is acceptable, and the change is scoped to a DRY refactor.

**Note on AGENTS.md §1.1:** The rule prohibits blocking operations *inside async functions*. `loadConfig`/`saveConfig` are synchronous functions, not async functions. The blocking I/O occurs at module-load time (synchronous context), not inside an async context. This is consistent with the prior `fix-sync-fs-in-async-functions` change, which explicitly scoped its fix to `existsSync()` *inside async functions* and left synchronous utility functions alone.

### Decision 3: Retain `structuredClone` in `applyDotPathMutation`

**Rationale:** `applyDotPathMutation` clones the whole config (`structuredClone(config)`), applies the dot-path mutation to the clone, validates with `ConfigSchema.parse(patched)`, and only then mutates the original. This provides a validate-before-mutate guarantee: if validation fails, the original config is left untouched. Removing the clone would mean mutating the original first, then validating — a failed validation would leave the config in an invalid, partially-mutated state.

**Alternatives considered:**
- Scope the clone to just the affected subtree — rejected: resolving the schema for an arbitrary dot-path is complex and error-prone, and the config is small enough that a full clone is cheap.
- Remove the clone and mutate-then-validate — rejected: breaks the validate-before-mutate guarantee and the existing test "does not mutate config when zod validation fails".

## Risks / Trade-offs

- **Risk:** The shared `parseValue` module could be imported in a way that creates a circular dependency.
  **Mitigation:** `src/config/parse.js` has no imports, so it cannot participate in a cycle. Verified by inspection.
- **Risk:** Re-exporting `parseValue` from `patch.js` could be mistaken for a wildcard export.
  **Mitigation:** It is a named re-export (`export { parseValue } from "./parse.js"`), which is allowed by AGENTS.md §1.1.
- **Risk:** Keeping `loadConfig` synchronous means a one-time blocking read at startup.
  **Mitigation:** The config is cached after the first call, so this is a single, bounded hit. Documented as an accepted trade-off.

## Migration Plan

- No migration needed — this is a behavioral-preserving refactor.
- All existing tests pass without modification.
- No configuration changes required.

## Open Questions

- None.
