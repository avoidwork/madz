# Tasks

## 1. Implement the env tool

- [ ] 1.1 Create `src/tools/env/index.js` with a Zod schema and a `createEnvTool()` factory that reads from `process.env`, and verify the module imports without error
- [ ] 1.2 Add JSDoc comments to all public functions (`@param`, `@returns`) and verify the file passes `npm run lint`

## 2. Register the env tool

- [ ] 2.1 Import `createEnvTool` in `src/tools/index.js` and add `env: createEnvTool` to the `TOOLS` map, and verify the module imports without error
- [ ] 2.2 Add `env: ["env:read"]` to `TOOL_PERMISSIONS` and `env` to `TOOL_CLASSIFICATIONS`, and verify the `tool_index.test.js` permission test still passes
- [ ] 2.3 Add a `case "env"` in `buildToolConfig()` that gates on `hasAllPerms` and pushes `TOOLS.env()`, and verify the `tool_index.test.js` buildToolConfig tests still pass

## 3. Write unit tests

- [ ] 3.1 Add `tests/unit/tools/env.test.js` covering reading known variables, missing/unset variables, and input validation, and verify `npm run test` passes for that file
- [ ] 3.2 Add a permission-gating test in `tests/unit/tools/env.test.js` verifying the tool registers only when `env:read` is enabled, and verify it passes

## 4. Write integration test

- [ ] 4.1 Add `tests/integration/tools/env.test.js` confirming the tool registers when `env:read` is enabled and does not register when it is absent, and verify `npm run test` passes for that file

## 5. Verify full suite

- [ ] 5.1 Run `npm run test` and verify all tests pass
- [ ] 5.2 Run `npm run lint` and verify lint passes
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained (coverage.txt regenerated)

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
