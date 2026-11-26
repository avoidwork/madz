# Design

## Context

`loadConfig()` in `src/config/loader.js` sets `config.cwd = process.cwd()` and caches the result in a module-level `cachedConfig`. `src/config/config.js` already maintains a separate module-level `resolvedConfig` reference (set via `_setResolvedConfig`, read via an internal `getResolvedConfig`) that `normalizeSandboxPaths` mutates. Modules across `src/tools/memory`, `src/tools/todo`, `src/skills`, and `src/session` freeze `config.cwd` into a top-level `const cwd = loadConfig().cwd` at import time, so they pin to whatever directory was active on first import. See proposal.md - Why and the `config-system` spec for the behavior contract.

## Goals / Non-Goals

**Goals:**
- Provide a validated `setConfig({ cwd })` that pins the effective cwd to an absolute, real, existing directory and rejects escapes.
- Make `loadConfig()` honor an explicitly-set cwd across cached calls.
- Let consuming modules resolve cwd from the live resolved config at call time instead of a frozen import-time snapshot, without changing exported signatures.
- Add a regression test proving the fix.

**Non-Goals:**
- Changing the per-call default-parameter modules (`src/memory/tools.js`, `expireEphemeralMemories.js`, `screenshots.js`, `contextDir.js`, `retention.js`) — they already re-evaluate per call.
- Redesigning the config caching strategy or env-var resolution.
- Introducing a new config file or CLI flag for cwd.

## Decisions

### Decision: Add `setConfig()` to the loader, backed by the resolved-config reference
`setConfig({ cwd })` lives in `src/config/loader.js`. It normalizes the input (resolve to absolute, `realpathSync` to the real path, verify the target exists and is a directory) and writes the result into the cached config object's `cwd` field, then re-runs `_setResolvedConfig` so `normalizeSandboxPaths` re-anchors sandbox paths against the new cwd.

- **Why:** The resolved config object is the single shared instance every consumer reads; mutating it in place (rather than replacing the reference) keeps `loadConfig()` returning the same object and preserves the existing `_setResolvedConfig`/`normalizeSandboxPaths` contract.
- **Alternative considered:** A standalone `setCwd()` that only touches `cwd`. Rejected — it would desync `normalizeSandboxPaths`, which re-derives sandbox entries from `config.cwd`.

### Decision: `loadConfig()` skips the `process.cwd()` overwrite when a cwd was explicitly set
A module-level flag (`_cwdExplicitlySet`) records whether `setConfig()` has pinned a cwd. Inside `loadConfig()`, the `config.cwd = process.cwd()` assignment runs only when the flag is false. On the cached path, `loadConfig()` returns early and never re-derives cwd, so the pinned value persists.

- **Why:** The bug is precisely that `process.cwd()` overwrites the intended root; gating that assignment on the explicit-set flag makes the init-provided value authoritative.
- **Alternative considered:** Always reading cwd from `process.cwd()` lazily. Rejected — it reintroduces the drift the fix removes and breaks determinism for tests.

### Decision: Consumers read cwd from the live resolved config, not a top-level constant
Each frozen module replaces its top-level `const cwd = loadConfig().cwd` with a small accessor that returns `loadConfig().cwd` (or the resolved-config getter) at call time. Default-parameter signatures (`cwdParam = cwd`) are preserved by pointing the default at the accessor's return value, so callers are unaffected.

- **Why:** Deriving cwd lazily means a `process.chdir()` after import no longer desyncs the module from the init-provided root.
- **`src/skills/discoverer.js`:** keeps its existing exported mutable `cwd` + `setCwd()` API; the frozen `defaultScope`/`cwd` initialization is re-derived from the resolved config so the default reflects the pinned cwd.
- **Alternative considered:** Calling `setConfig()` from inside each module's import. Rejected — import-time side effects on global config are fragile and order-dependent; lazy derivation is pure and testable.

### Decision: Validation rejects escapes via realpath + root containment
`setConfig()` resolves the candidate with `path.resolve` then `fs.realpathSync`, requires the result to exist and be a directory, and confirms it is contained within the allowed root (the init cwd or an explicitly-configured root). Relative paths resolve against `process.cwd()`; non-existent, non-directory, or escaping paths throw a `RangeError`/`Error` with a clear message.

- **Why:** The security requirement demands the cwd cannot be used to escape the intended working directory; realpath collapses symlinks so a symlinked path cannot smuggle the resolution outside the root.

## Risks / Trade-offs

- [Import order still determines the *first* cwd snapshot] → Mitigation: the init hook calls `setConfig()` before any consumer module is imported for real use, and consumers derive lazily, so the first snapshot is the pinned value, not an incidental `process.cwd()`.
- [realpathSync throws on non-existent paths] → Mitigation: `setConfig()` checks existence with `statSync`/`access` before realpath and throws a controlled error instead of an unhandled one.
- [Changing cwd semantics could affect sandbox path validation] → Mitigation: re-running `_setResolvedConfig` after a set re-normalizes `sandbox.paths` against the new cwd, keeping them consistent.
- [Tests share module-level config state under `node --test`] → Mitigation: the regression test uses dynamic `import()` plus `_resetConfigCache()` and restores `process.cwd()` in `afterEach`.

## Migration Plan

Shippable as a normal patch. No data migration. Rollback is a revert of the change; the new `setConfig()` API is additive and unused by callers that do not opt in, so reverting leaves existing behavior intact.

## Open Questions

None.
