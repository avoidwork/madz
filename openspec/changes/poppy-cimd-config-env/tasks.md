# Tasks

## 1. Config Schema

- [ ] 1.1 Create `src/config/schemas/poppy.js` defining `PoppyConfigSchema` (Zod object: `clientId` and `jwksUri` as `z.string().url()`, `clientName` as `z.string().min(1)`, `redirectUris` as `z.array(z.string()).min(1)`, optional `logoUri` as `z.string().url()`) and verify the schema validates a valid CIMD and rejects invalid URLs / empty `redirectUris`
- [ ] 1.2 Re-export `PoppyConfigSchema` from `src/config/schemas/index.js` and verify the export resolves
- [ ] 1.3 Register `poppy: PoppyConfigSchema.default({})` in `ConfigSchema` in `src/config/config.js`, re-export `PoppyConfigSchema` from `config.js`, and verify `ConfigSchema.parse({})` succeeds and the shape includes `poppy`

## 2. Loader Mapping

- [ ] 2.1 Verify `KNOWN_SECTIONS` in `src/config/loader.js` includes `poppy` and `buildReverseMap(ConfigSchema)` maps `poppy.*` paths to `POPPY_*` env names (including indexed `POPPY_REDIRECT_URIS_0`), confirming no `DROPPED_KEYS` change is needed
- [ ] 2.2 Verify `_resolveEnvRecursively` resolves `POPPY_CLIENT_ID`, `POPPY_CLIENT_NAME`, `POPPY_JWKS_URI`, `POPPY_LOGO_URI`, and indexed `POPPY_REDIRECT_URIS_0` to the correct config paths

## 3. Tool Sourcing

- [ ] 3.1 In `src/tools/poppy/identity.js`, change `buildMetadata` to source `clientId`, `clientName`, `jwksUri`, `redirectUris`, `logoUri` from `input` first, falling back to config/env values (via `options`) when absent, and verify it returns the CIMD when input omitted but config provided and errors when neither present
- [ ] 3.2 In `src/tools/index.js`, thread the resolved `poppy` config into the poppy tool's runtime options and add the new key to `CONSUMED_RUNTIME_OPTION_KEYS`, and verify the guard test (`tests/unit/tool_index.test.js`) passes

## 4. Tests

- [ ] 4.1 Add `tests/unit/config/poppy.test.js` verifying `PoppyConfigSchema` validation, `ConfigSchema` includes `poppy`, `KNOWN_SECTIONS` includes `poppy`, `buildReverseMap` maps `poppy.*` to `POPPY_*`, and `_resolveEnvRecursively` resolves `POPPY_*` env vars, and verify the tests pass
- [ ] 4.2 Add integration tests in `tests/unit/tools/poppy/identity.test.js` for `buildMetadata` sourcing values from config/env when input params are omitted and erroring when neither input nor config provides required fields, and verify the tests pass

## 5. Verification

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` and verify all pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
