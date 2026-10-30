# Design

## Context

See proposal.md - Why. The `process` tool's `unifiedProcessImpl` in `src/tools/process/index.js` currently returns a mix of bare strings and `JSON.stringify(entries)`. The helpers `executeForeground` and `executeBackground` also return bare strings. The spec delta for `unified-process-tool` defines the new structured response contract.

## Goals / Non-Goals

**Goals:**
- Make every return path of `unifiedProcessImpl` yield a native structured object.
- Preserve the existing payload fields (exitCode, stdout, stderr, pid, command, entries) so callers retain access to the data.
- Keep the `processTracker` data model and `trackProcess` API unchanged.

**Non-Goals:**
- No change to the tool's input schema, action enum, or process tracking internals.
- No change to other tools or the deepagents tool set.

## Decisions

**Decision: Use a plain object with an `ok` boolean discriminator.**
- Rationale: Simple, JSON-serializable, and matches the issue's requested shape (`{ ok: true, ... }` / `{ ok: false, error: ... }`). A wrapper class was rejected as over-engineering.
- Alternative considered: Returning a wrapper class — rejected as over-engineering for a simple structured object.

**Decision: Preserve payload fields on success objects.**
- Rationale: Callers that need the actual data (exit code, output, PID, entries) should not lose access. The `list` action returns `{ ok: true, entries }` rather than a JSON string.
- Alternative considered: Returning only `{ ok: true }` — rejected because it strips useful data.

**Decision: `executeForeground` and `executeBackground` return native objects.**
- Rationale: The `start` action delegates to these helpers; if they return strings, the structured contract is broken at the top level. They now return `{ ok: true, ... }` or `{ ok: false, error: ... }`.

**Decision: The `wait` action resolves its Promise to a structured object.**
- Rationale: It currently resolves to a bare string. It will resolve to `{ ok: true, ... }` on completion or `{ ok: false, error: "..." }` on timeout.

## Risks / Trade-offs

- [Breaking change to the tool's response contract] → This is internal to the harness and aligned with the issue's intent. Only the unit tests consume the old string format directly; they are updated in the same change.
- [Tests that relied on string output (e.g., `result.includes(...)`) must be rewritten] → The test file is updated to inspect the object shape (`result.ok`, `result.error`, `result.entries`, `result.pid`).
- [Coverage may shift if new branches are added] → New error branches are covered by the updated tests; `npm run coverage` is run to confirm line coverage is maintained.
