# Proposal

## Why

The Poppy tool currently requires its CIMD (Client Metadata Document) configuration values — `clientId`, `clientName`, `jwksUri`, `redirectUris`, and optional `logoUri` — to be passed as tool input parameters to the `identity` action's `build_metadata` operation. This makes configuration rigid and prevents these values from being set via environment variables or `config.yaml`. This change adds a `poppy` section to the config schema, maps its fields to `POPPY_*` environment variables via the existing schema-driven loader, and sources these values from config/env in the poppy identity action instead of requiring them as input params.

## What Changes

- Add a `poppy` section to `ConfigSchema` in `src/config/config.js` with fields `clientId`, `clientName`, `jwksUri`, `redirectUris` (array), and optional `logoUri`.
- Define a new `PoppyConfigSchema` in `src/config/schemas/poppy.js` and re-export it from `src/config/config.js` and `src/config/schemas/index.js`.
- Map `poppy.*` config paths to `POPPY_*` env vars via the existing schema-driven loader (`_resolveEnvRecursively` / `buildReverseMap` / `syncEnv`). No `DROPPED_KEYS` change needed since `poppy` is not dropped.
- Change the poppy `identity` action's `build_metadata` to source CIMD values from config/env when input params are absent, instead of erroring.
- Thread the resolved `poppy` config into the poppy tool's runtime options via `buildToolConfig` in `src/tools/index.js`, and register the new runtime option key in `CONSUMED_RUNTIME_OPTION_KEYS`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `poppy-agent-identity`: The agent's client metadata document (CIMD) values SHALL be sourceable from the `poppy` config section / `POPPY_*` environment variables as a fallback when not provided as tool input parameters, in addition to the existing input-parameter path.

## Impact

- `src/config/schemas/poppy.js` (new) — `PoppyConfigSchema`
- `src/config/schemas/index.js` — re-export `PoppyConfigSchema`
- `src/config/config.js` — register `poppy` in `ConfigSchema`, re-export `PoppyConfigSchema`
- `src/config/loader.js` — verify mapping (no manual change expected)
- `src/tools/poppy/identity.js` — source CIMD values from config/env in `buildMetadata`
- `src/tools/index.js` — thread `poppy` config into runtime options, add to `CONSUMED_RUNTIME_OPTION_KEYS`
- `tests/unit/config/poppy.test.js` (new) — schema + loader mapping tests
- `tests/unit/tools/poppy/identity.test.js` — integration test for config/env sourcing

## Non-goals

- No new npm dependencies.
- No directory mounting for CIMD/JWKS (they are URLs, not filesystem artifacts).
- No change to the `oauth` action's use of `clientId`.
