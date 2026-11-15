# Tasks

## 1. Create env tool implementation

- [ ] 1.1 Create `src/tools/env/index.js` with `envImpl` that reads from `process.env` and returns a structured result `{ ok: true, ... }` or `{ ok: false, error }`. Verify the module imports without error.
- [ ] 1.2 Export `env` as a first-class tool instance via `tool((input, options = {}) => envImpl(input, options), { name: "env", description, schema })` with a Zod schema (`z.object({ name: z.string().optional(), all: z.boolean().optional() })`). Verify `env.name === "env"` and `env.schema` is a Zod object.

## 2. Register tool in index

- [ ] 2.1 Import `env` in `src/tools/index.js`. Verify the import resolves.
- [ ] 2.2 Add `env: ["env:read"]` to `TOOL_PERMISSIONS`. Verify `TOOL_PERMISSIONS.env` deep-equals `["env:read"]`.
- [ ] 2.3 Add `env` to `TOOL_CLASSIFICATIONS` with agent types (`coding`, `debug`, `performance`, `search`, `code-review`, `research`, `testing`, `documentation`, `security-audit`). Verify `TOOL_CLASSIFICATIONS.env` is a non-empty array.
- [ ] 2.4 Add `env` to the `TOOLS` map. Verify `TOOLS.env` is defined.
- [ ] 2.5 Add a `case "env"` in `buildToolConfig()` that pushes `TOOLS.env` only when `hasAllPerms` is true. Verify `buildToolConfig` registers `env` with `env:read` enabled and excludes it without.

## 3. Write tests

- [ ] 3.1 Create `tests/unit/tools/env.test.js` with tests for reading a single named variable (returns `{ ok: true, name, value }`). Verify the test passes.
- [ ] 3.2 Add a test for `{ all: true }` returning the full environment. Verify the test passes.
- [ ] 3.3 Add a test for invalid input returning `{ ok: false, error }`. Verify the test passes.
- [ ] 3.4 Add a test that `env` has correct metadata (name, description, schema). Verify the test passes.
- [ ] 3.5 Add a test that `env` registers in `buildToolConfig` with `env:read` enabled and does not register without it. Verify the test passes.
- [ ] 3.6 Add a test that env values are not leaked into logs (assert no `console.log`/logger output of the value). Verify the test passes.

## 4. Verify

- [ ] 4.1 Run `npm run lint` and confirm no lint errors.
- [ ] 4.2 Run `npm run test` and confirm all tests pass.
- [ ] 4.3 Run `npm run coverage` and confirm coverage is maintained.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
