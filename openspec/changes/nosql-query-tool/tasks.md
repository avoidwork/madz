# Tasks

## 1. Dependencies

- [ ] 1.1 Add `mongodb` (^7.9.0) and `ioredis` (^6.0.0) to package.json dependencies and run `npm install` to update package-lock.json. Verify both packages import cleanly with `node -e "import('mongodb').then(()=>console.log('mongodb ok'))"`.

## 2. Engine Modules

- [ ] 2.1 Create `src/tools/nosql/engines/mongodb.js` exporting `name`, `connectionSchema`, `operationSchema`, and `execute(input, options)`. Verify the module imports and exports the required members.
- [ ] 2.2 Create `src/tools/nosql/engines/redis.js` exporting `name`, `connectionSchema`, `operationSchema`, and `execute(input, options)`. Verify the module imports and exports the required members.

## 3. Core Tool

- [ ] 3.1 Create `src/tools/nosql/index.js` with an `ENGINES` map, `nosqlImpl` dispatch, `closeAll()`, and `export const nosql = tool(...)` using a discriminated union on `engine`. Verify the module imports and the `nosql` tool exports correctly.
- [ ] 3.2 Verify `nosqlImpl` rejects an unknown engine and an invalid operation, returning `{ ok: false, kind }`.

## 4. Tool Registry

- [ ] 4.1 Register `nosql` in `src/tools/index.js`: import, `TOOL_PERMISSIONS` (`network:outbound`, `filesystem:read`, `filesystem:write`), `TOOL_CLASSIFICATIONS`, `TOOLS`, `ORCHESTRATOR_TOOLS`, and a `case "nosql"` in `buildToolConfig()`. Verify `buildToolConfig` includes `nosql` when permissions are satisfied.

## 5. Config Schema

- [ ] 5.1 Create `src/config/schemas/nosql.js` exporting `NosqlConfigSchema` with empty safe defaults for every key. Verify `loadConfig()` succeeds with no `nosql:` block.
- [ ] 5.2 Export `NosqlConfigSchema` from `src/config/schemas/index.js` and add `nosql` to `ConfigSchema` in `src/config/config.js` with `.default({})`. Verify `ConfigSchema.parse({})` succeeds.

## 6. Env Var Support

- [ ] 6.1 Add `nosql` to both `DROPPED_KEYS` lists in `src/config/loader.js`. Verify `MONGODB_HOST` resolves to `nosql.mongodb.host` and `REDIS_PASSWORD` resolves to `nosql.redis.credentials.password`.

## 7. Unit Tests

- [ ] 7.1 Add `tests/unit/tools/nosql.test.js` covering Zod schema validation for all engines, rejection of invalid engine/operation, `nosqlImpl` validation, and the `ENGINES` registry contract. Verify `npm run test` passes the new test.

## 8. Integration Test

- [ ] 8.1 Add `tests/integration/tools/nosql.test.js` running operations against in-memory MongoDB and Redis mocks. Verify the integration test passes.

## 9. Documentation

- [ ] 9.1 Add JSDoc comments to all public functions in `src/tools/nosql/**` with `@param` and `@returns`. Verify `npm run lint` passes.
- [ ] 9.2 Document NoSQL env vars in `docs/CONFIGURATION.md` under a NoSQL section. Verify the documented env vars match the schema.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
