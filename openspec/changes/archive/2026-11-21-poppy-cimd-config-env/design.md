# Design

## Context

See proposal.md - Why. The Poppy `identity` action's `build_metadata` operation currently requires CIMD values (`clientId`, `clientName`, `jwksUri`, `redirectUris`, `logoUri`) as tool input parameters and errors if absent. The config system already supports schema-driven env-var materialization via `_resolveEnvRecursively`, `buildReverseMap`, and `syncEnv` in `src/config/loader.js`. The poppy tool is registered in `src/tools/index.js` and already threads runtime options (e.g., `keyDir`) into `poppyImpl`.

## Goals / Non-Goals

**Goals:**
- Add a `poppy` config section with CIMD fields, validated by a new `PoppyConfigSchema`.
- Map `poppy.*` to `POPPY_*` env vars via the existing schema-driven loader.
- Source CIMD values from config/env in `buildMetadata` when input params are absent.
- Thread the resolved `poppy` config into the poppy tool's runtime options.

**Non-Goals:**
- No new npm dependencies.
- No directory mounting for CIMD/JWKS.
- No change to the `oauth` action's use of `clientId`.

## Decisions

### Decision 1: Schema-driven env mapping (no manual loader change)
The loader derives env-var names from the config schema. Since `poppy` is NOT in `DROPPED_KEYS`, adding `poppy` to `ConfigSchema` automatically produces `POPPY_CLIENT_ID`, `POPPY_CLIENT_NAME`, `POPPY_JWKS_URI`, `POPPY_LOGO_URI`, and indexed `POPPY_REDIRECT_URIS_0`, etc. `KNOWN_SECTIONS` is derived from `ConfigSchema` shape, so `poppy` is auto-included in the prefix allowlist.
- **Alternative considered:** Hardcoding env mappings in the loader. Rejected — inconsistent with the schema-driven design and requires manual `DROPPED_KEYS` maintenance.

### Decision 2: Config over input, input overrides config
`buildMetadata` prefers explicit input params when provided, falling back to config/env values. This preserves backward compatibility while enabling config-based setup.
- **Alternative considered:** Requiring config exclusively. Rejected — breaks existing input-param callers.

### Decision 3: Thread `poppy` config via runtime options
`buildToolConfig` in `src/tools/index.js` already threads `keyDir` from `config.memory.toolsDir` into `poppyImpl`. Add a `poppyConfig` runtime option sourced from `config.poppy`, and register it in `CONSUMED_RUNTIME_OPTION_KEYS` (the guard test in `tests/unit/tool_index.test.js` fails CI if a runtimeOptions key lacks a consumer).
- **Alternative considered:** Reading `process.env` directly in `identity.js`. Rejected — bypasses the config system and the resolved config object.

### Decision 4: Array env var indexing for redirectUris
`redirectUris` is an array. `_resolveEnvRecursively` recurses into array elements with an index path, producing `POPPY_REDIRECT_URIS_0`, `POPPY_REDIRECT_URIS_1`, etc. This is documented and tested rather than flattened to a single `POPPY_REDIRECT_URIS`.

## Risks / Trade-offs

- [Indexed array env vars are non-obvious] → Document and test `POPPY_REDIRECT_URIS_0` indexing explicitly.
- [Guard test fails if runtime option key lacks consumer] → Add `poppyConfig` to `CONSUMED_RUNTIME_OPTION_KEYS` in the same change.
- [Config threading changes tool registration] → Verify the poppy tool still registers and the identity action still works with input params.

## Migration Plan

Backward compatible: existing input-param callers continue to work. Config/env is an additive fallback. No rollback risk beyond reverting the schema addition and the `buildMetadata` change.

## Open Questions

None.
