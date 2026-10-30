# Design

## Context

See proposal.md - Why. The `config` tool (`getConfigImpl` in `src/tools/config/index.js`) currently returns `JSON.stringify(config, null, 2)`. The codebase convention for tools is to return native structured objects (`{ ok: boolean, ... }`), as seen in `web`, `image`, `calendar`, and `json`. The `loadConfig()` call is not wrapped in error handling, so any thrown error propagates as an unhandled rejection.

## Goals / Non-Goals

**Goals:**
- Return `{ ok: true, config }` on success, where `config` is the parsed object (not a string).
- Return `{ ok: false, error: <message> }` on failure, never throwing.
- Update the JSDoc `@returns` annotation to the new structured shape.
- Update `tests/unit/tools/getConfig.test.js` to assert the new shape and cover the failure path.

**Non-Goals:**
- No change to `src/config/loader.js` or `loadConfig()`.
- No change to the tool's metadata (name, description, strict zod schema).
- No change to other tools or the tool registry.

## Decisions

- **Return the parsed object by reference.** `return { ok: true, config }` returns the actual parsed config object, so consumers access properties directly without parsing. Alternative considered: returning `{ ok: true, config: JSON.parse(JSON.stringify(config)) }` — rejected as unnecessary since `loadConfig()` returns a fresh object and no mutation is expected.
- **Catch at the tool boundary.** Wrap `loadConfig()` in try/catch and return `{ ok: false, error: err.message }`. This follows AGENTS.md §3.3 ("catch at the boundary"). Alternative considered: letting the error propagate — rejected because the issue explicitly requires the tool to never throw.
- **Update the existing test file in place.** `tests/unit/tools/getConfig.test.js` already exists and covers the tool. The assertions that call `JSON.parse(result)` are updated to access `result.config` directly. A new test asserts the failure path returns `{ ok: false, error }`.

## Risks / Trade-offs

- [Consumers relying on `JSON.parse(result)` will break] → This is the intended contract change described in the issue; the test file is updated accordingly.
- [The tool now swallows `loadConfig()` errors into a structured response] → This is the desired behavior per the issue's "Add error handling" step; the error message is preserved in the `error` field.
- [The `config` object is returned by reference and could be mutated by consumers] → `loadConfig()` returns a cached object; consumers are expected to treat it as read-only. No mutation is introduced by this change.
