# Design

## Context

See proposal.md - Why. The `discovery` tool's impl functions currently return bare strings, making success/failure indistinguishable and data unparseable. This change standardizes them to structured objects.

## Goals / Non-Goals

**Goals:**
- Return `{ ok: true, ... }` on success and `{ ok: false, error: ... }` on failure from all four impl functions.
- Keep the existing `discovery` tool schema, actions, and permission model unchanged.
- Update JSDoc `@returns` annotations and tests to match the structured shape.

**Non-Goals:**
- No change to other tools or their response formats.
- No new dependencies or architectural changes.

## Decisions

### Decision 1: Use `{ ok, ... }` as the structured envelope
The `ok` boolean is the discriminator. Success payloads carry the relevant data (`entries`, `matches`, `count`); failures carry an `error` string. This mirrors the pattern used by other tools in the codebase and is machine-parseable.

- **Alternative considered:** JSON.stringify-wrapped strings. Rejected — still strings, not structured objects.

### Decision 2: `nativeSearch` fallback also returns structured objects
The `grepImpl` fallback to `nativeSearch` must return `{ ok: true, matches, count }` so the grep path is consistent regardless of whether ripgrep is available.

- **Alternative considered:** Leaving `nativeSearch` as a bare string. Rejected — creates an inconsistent grep response shape.

### Decision 3: `discoveryImpl` returns `{ ok: false, error }` for unknown action
The dispatcher's default branch returns a structured error. Success paths flow through the impls unchanged.

## Risks / Trade-offs

- **[Existing tests assert bare strings]** → Update `tests/unit/tools/discovery.test.js` and `tests/integration/tools/discovery.test.js` to assert the structured shapes; run `npm run test` and `npm run coverage`.
- **[Consumers relying on string output]** → This is an intentional breaking change to the tool's response contract; the spec delta documents the new behavior.
