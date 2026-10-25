## Context

madz currently does not own its file tools. The eight filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `delete`, `glob`, `grep`, `execute`) come from deepagents' `createFilesystemMiddleware`, and madz only wraps that middleware via `createEvictionAwareFilesystemMiddleware` in `src/agent/evictionCeiling.js`. This means:

1. madz doesn't control the tool surface — the library decides what each tool does.
2. Sandbox validation is not guaranteed — the library's tools may not respect madz's `allowedPaths` validation (`validatePath` in `src/tools/common.js`).
3. `src/tools/index.js` `buildToolConfig` has unreachable `case` branches for `readFile`, `writeFile`, `patch`, and `searchFiles` — dead code from tools removed in PR #543 (`37100fdd`).

The `todo` tool is the template: madz's own implementation, registered as a first-class tool, better than the library default. We want the same for file I/O.

## Goals / Non-Goals

**Goals:**
- Create a single `file` tool with an `action` key (the `todo`/`memory` pattern) that owns and sandboxes madz's file I/O.
- Register `file` in the tool registry and remove the dead `readFile`/`writeFile`/`patch`/`searchFiles` cases.
- Replace the deepagents filesystem middleware so it supplies madz's `file` tool instead of the library's eight, keeping the name `"FilesystemMiddleware"`.
- Add unit + integration tests and update the eviction middleware regression test.

**Non-Goals:**
- No `execute` action in the `file` tool — shell execution stays in the `process` tool.
- No patching of the deepagents library dist via postinstall.
- No restoration of the old four-tool `filesystem.js` surface.

## Decisions

### Decision 1: Single `file` tool with an `action` key

**Chosen:** One `file` tool with an `action` enum (`read`, `write`, `edit`, `delete`, `search`, `ls`, `glob`, `grep`), matching the `todo`/`memory` pattern.

**Alternatives considered:**
- **Four separate tools** (`readFile`, `writeFile`, `patch`, `searchFiles`) — more surface, doesn't match the `todo`/`memory` convention. Rejected.
- **Keep the library tools and add `file` alongside** — leaves the duplicate surface and the sandbox concern. Rejected.

### Decision 2: `edit` replaces `patch`

The old `patch` action is renamed `edit` for clarity. It applies a unified-diff patch (reusing `generateUnifiedDiff` from the removed `filesystem.js`) or a string replacement via `oldString`/`newString`. The fuzzy-match strategies (`fuzzyMatch`) are preserved so edits are resilient to whitespace/case drift.

### Decision 3: Replace the middleware, not patch the library

**Chosen:** Approach 1 — replace the middleware. `createEvictionAwareFilesystemMiddleware` in `src/agent/evictionCeiling.js` currently calls `createFilesystemMiddleware({...})` which *supplies* the eight tools. Instead, build a middleware that supplies **only** madz's `file` tool (or no filesystem tools at all), letting the orchestrator/subagents use madz's registered `file` tool.

**Alternatives considered:**
- **Patch the library dist via postinstall** (like `scripts/patch-langchain-reasoning.mjs`) — works but fragile against upstream changes. Rejected.

**Key constraint:** The middleware must keep the name `"FilesystemMiddleware"` so it displaces the library default via same-name Map merge in `mergeMiddlewareStack`. A drifted name stacks a second copy — the bug survives while looking fixed. This is asserted in `tests/unit/evictionCeiling.test.js`.

### Decision 4: Subagents get their own middleware instance

deepagents does NOT propagate the orchestrator's custom middleware to configured inline subagents — parent custom middleware reaches just the auto-injected `general-purpose` subagent. Each of the 12 configured subagents needs its own `createEvictionAwareFilesystemMiddleware` instance, built fresh per subagent to avoid sharing mutable state. This is already the pattern in `src/agent/deepAgents.js` (line ~96).

### Decision 5: Reuse `validatePath` + `checkFileLimit`

Every path is validated against `allowedPaths` via `validatePath`; size limits enforced via `checkFileLimit`. No new npm packages — reuses `node:fs/promises` and existing helpers in `src/tools/common.js`.

## Risks / Trade-offs

- **[Middleware name drift]** → Asserted in `tests/unit/evictionCeiling.test.js`; the name must stay exactly `"FilesystemMiddleware"`.
- **[Subagent tool availability]** → Each subagent gets its own middleware instance built fresh; verified by the existing subagent-definition test.
- **[Removing the library's `execute` tool]** → The `file` tool intentionally excludes `execute`; shell execution stays in the `process` tool. Subagents that relied on the library `execute` must use `process` instead.
- **[Fuzzy edit complexity]** → Preserved from `filesystem.js`; covered by unit tests for the `edit` action.
