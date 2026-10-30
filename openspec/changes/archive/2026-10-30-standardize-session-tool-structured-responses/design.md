# Design

## Context

See proposal.md - Why. The `searchSession` tool's `searchSessionImpl` dispatcher and its three delegate helpers (`getFullConversation`, `searchConversations`, `browseConversations`) in `src/tools/session/index.js` currently return bare strings. This design standardizes them to return structured objects with an `ok` discriminator.

## Goals / Non-Goals

**Goals:**
- All three delegate paths return a consistent structured shape `{ ok: true, ... }` / `{ ok: false, error }`.
- The `ok` boolean is the canonical success/failure discriminator.
- Preserve the existing payload content (conversation body, snippets, conversations array) so consumers still get the same information.

**Non-Goals:**
- No changes to the `searchSession` zod schema or tool registration.
- No changes to other tools.
- No new packages or dependencies.

## Decisions

**Decision 1: Convert at the dispatcher boundary.**
The conversion happens in `searchSessionImpl` (lines 42/46/49) so all three delegate paths return a consistent shape regardless of which helper is invoked. Each helper is updated to return a structured object directly, and the dispatcher simply returns the helper's result.

**Decision 2: Use `ok` as the discriminator.**
`ok: true` on success, `ok: false` on failure. This is the simplest, most conventional discriminator and matches the issue's proposed shape.

**Decision 3: Spread the payload into the success object.**
On success, the helper returns `{ ok: true, conversation }`, `{ ok: true, snippets }`, or `{ ok: true, conversations }`. This keeps the payload at the top level, self-describing, and avoids a nested `data` wrapper.

**Decision 4: `error` carries a human-readable string on failure.**
Each failure path returns `{ ok: false, error: <message> }`, preserving the existing human-readable messages (e.g. "No conversations directory found", "Conversation not found: <id>", "No conversations matched query ...").

**Alternatives considered:**
- Keeping bare strings — rejected because it is inconsistent with the structured-object convention and forces consumers to parse.
- Wrapping in a `data` field — rejected because it adds an unnecessary nesting level; spreading the payload is simpler.

## Risks / Trade-offs

- [Existing tests assert string returns] → Update `tests/unit/tools_session_search.test.js` to assert the new object shape; the tests are the contract for the new behavior.
- [Consumers of the tool may expect strings] → The `searchSession` tool is the only consumer surface; the response shape change is the intended behavior per the issue. No other in-repo consumers were found.

## Migration Plan

No migration required. This is a response-shape refactor with no external API or data model changes. Rollback is a revert of the PR.

## Open Questions

None.
