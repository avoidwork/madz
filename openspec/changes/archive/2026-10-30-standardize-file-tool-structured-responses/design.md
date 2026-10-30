# Design

## Context

The `file` tool's impl functions in `src/tools/file/index.js` return bare strings. See proposal.md - Why for motivation. This design covers the technical approach to converting them to structured objects while preserving all existing behavior (path validation, size limits, fuzzy matching, unified diff generation).

## Goals / Non-Goals

**Goals:**
- Return `{ ok: true, ... }` on success and `{ ok: false, error: ... }` on failure from all five impl functions.
- Preserve all existing file-operation behavior.
- Update JSDoc `@returns` annotations and tests.

**Non-Goals:**
- No change to path validation, size limits, fuzzy matching, or diff generation logic.
- No new capabilities, tools, or dependencies.
- No change to the `process` tool.

## Decisions

### Decision 1: Use `{ ok: boolean }` envelope
Adopt the `{ ok: true, ... }` / `{ ok: false, error: ... }` envelope, consistent with other tools in the codebase (e.g., `todo`, `memory`) that already use structured responses.

**Alternatives considered:**
- Keep bare strings — rejected: not machine-parseable, success/failure indistinguishable.
- JSON.stringify-wrapped strings — rejected: still strings, not structured objects.

### Decision 2: Preserve `line|text` format in `readImpl` `lines` array
On success, `readImpl` returns `{ ok: true, content, lines }` where `content` is the raw file content and `lines` is the array of `LINE_NUM|CONTENT` strings (or the sliced subset when `offset`/`limit` is provided). This retains the display format while adding structured `content`.

### Decision 3: Include `suggestions?` on edit failure
`editImpl` returns `{ ok: false, error, suggestions? }` on no-match failure, carrying the fuzzy-match suggestions when available.

## Risks / Trade-offs

- [Existing consumers parse bare strings] → They must adapt to structured objects; this is the intended improvement.
- [Tests assert bare-string patterns] → Update unit and integration tests to assert structured object shapes.
