# Design

## Context

See proposal.md - Why. The `date` tool's `dateImpl` currently returns a bare string, which is not machine-parseable and does not distinguish success from failure. Sibling tools (`json`, `data`) already return structured `{ ok, ... }` objects and serialize them to JSON strings in their LangChain tool wrappers.

## Goals / Non-Goals

**Goals:**
- Return `{ ok: true, date, format }` on success and `{ ok: false, error }` on failure from `dateImpl`.
- Keep the `date` tool's `name`, `description`, and `schema` unchanged.
- Match the established structured-response convention used by `json`/`data` tools.

**Non-Goals:**
- No changes to other tools' response shapes.
- No new npm dependencies.
- No changes to the `date` tool's input schema or behavior for valid inputs.

## Decisions

**Decision 1: Return `{ ok: true, date, format }` rather than `{ ok: true, data }`.**
The issue specifies `{ ok: true, ... }` with the date value and format. Using `date` and `format` as named fields is more explicit than a generic `data` field and matches the issue's stated contract. Alternative considered: `{ ok: true, data: <string> }` (as in `json`/`data` tools) — rejected because the issue explicitly requests `date` and `format` fields.

**Decision 2: Add a defensive invalid-format check in `dateImpl`.**
The Zod schema constrains `format` to `z.enum(["iso", "human"])`, but `dateImpl` is a public export that may be called directly. A defensive guard returns `{ ok: false, error }` for unsupported formats, preventing a bare-string leak. Alternative considered: rely solely on the Zod schema — rejected because direct callers bypass schema validation.

**Decision 3: Serialize the structured result to a JSON string in the `date` tool wrapper.**
The LangChain `tool()` wrapper must return a string for the LLM. `JSON.stringify(result, null, 2)` matches the `json`/`data` tool convention. Alternative considered: return the object directly — rejected because LangChain tools expect a string return value.

## Risks / Trade-offs

- [Existing callers of `dateImpl` expecting a bare string will break] → This is the intended behavior change; the issue explicitly requests structured responses. Tests are updated accordingly.
- [The `date` tool wrapper now returns a JSON string instead of a bare string] → This is the intended contract change; the LLM receives a parseable structured object.
