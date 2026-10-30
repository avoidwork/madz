# Design

## Context

See proposal.md - Why. The `scanAgents` tool's `scanAgentsImpl` in `src/tools/scanAgents/index.js` currently returns a bare markdown string. The codebase convention for tool responses is a structured object `{ ok: true, ... }` / `{ ok: false, error: ... }` (see `src/tools/web/index.js`, `src/tools/image/index.js`, `src/tools/calendar/index.js`).

## Goals / Non-Goals

**Goals:**
- Return `{ ok: true, agents: <string> }` on success.
- Return `{ ok: false, error: <string> }` on path-validation failure.
- Keep the conversion at the `scanAgentsImpl` boundary so the shared `loadAgents` workspace utility is unchanged.
- Update the JSDoc `@returns` annotation and existing tests.

**Non-Goals:**
- Not changing `loadAgents`'s return type.
- Not changing the tool's input schema, permission tier, or registration.
- Not introducing new dependencies.

## Decisions

**Decision: Convert at the `scanAgentsImpl` boundary, not inside `loadAgents`.**
`loadAgents` is a shared workspace utility (`src/workspace/loadAgents.js`) used by other callers that may rely on its string return. Wrapping its result at the `scanAgentsImpl` boundary keeps the change scoped to the tool and avoids breaking other consumers.
- *Alternative considered:* Modify `loadAgents` to return a structured object. Rejected — it would ripple to all callers and is out of scope.

**Decision: Treat the "no AGENTS.md found" case as success (`{ ok: true, agents: "" }`).**
`loadAgents` returns `""` when no `AGENTS.md` exists. This is a valid "no file found" outcome, not an error, so it maps to a successful structured result with an empty `agents` field.
- *Alternative considered:* Treat it as `{ ok: false, error: "no AGENTS.md found" }`. Rejected — the existing spec and behavior treat "not found" as a silent success.

**Decision: Map the file-size-limit failure to `{ ok: false, error: <string> }`.**
`loadAgents` returns `limitCheck.error` (a string) when the file exceeds the max read size. This is a genuine failure and maps to the error shape.

## Risks / Trade-offs

- [The LangChain `tool()` wrapper may stringify the returned object] → Verify end-to-end that the tool still returns a usable structured object; the existing `buildToolConfig` registration test covers wiring.
- [Consumers that parsed the bare string will break] → This is the intended behavior change; the spec delta documents the new contract and tests are updated accordingly.
