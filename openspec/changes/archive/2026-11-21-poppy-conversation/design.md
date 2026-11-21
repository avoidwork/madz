# Design

## Context

See proposal.md - Why. The `poppy` tool in `src/tools/poppy/index.js` dispatches on an `action` enum via an `ACTIONS` registry, importing action modules as namespaces each exporting an `execute` function. Existing action modules (`discovery.js`, `identity.js`, `session.js`, `oauth.js`, `verify.js`, `api.js`) follow the sql/nosql driver/engine pattern. `common.js` exports `fetchJson`. `discovery.js` exports `validateUrl`. `jose` is already a dependency at v6.2.18.

## Goals / Non-Goals

**Goals:**
- Add a new `conversation` action module that starts, sends, reads, and streams messages with a company's agent.
- Support handoff to a person and direct conversations.
- Handle conversation state fields and section 8.13 errors.

**Non-Goals:**
- Modifying existing actions beyond registering `conversation`.
- Re-expanding the tool `description`.
- Implementing a full Poppy client library.

## Decisions

- **New `conversation` action module at `src/tools/poppy/conversation.js`.** Follows the existing action-module convention: exports `execute(input, options)` that dispatches on an `op` field via a `switch`, with internal handlers named without an `Action` suffix. Rationale: mirrors `api.js`/`oauth.js`.
- **Reuse `fetchJson` from `./common.js`** for non-streaming HTTP calls (start, send, read, handoff). Rationale: DRY, consistent timeout/error normalization.
- **Use raw `fetch` for SSE streaming** since `fetchJson` parses JSON and SSE is a text stream. Parse SSE frames (`data:` lines) and dispatch each event type. Rationale: `fetchJson` would fail on a text/event-stream body.
- **Reuse `validateUrl` from `discovery.js`** for HTTPS/non-private URL validation. Rationale: consistent security posture.
- **Use `jose`** for any signing needs. Rationale: already a dependency.
- **Register `conversation` in `ACTIONS`** and add `"conversation"` to the action enum plus conversation fields in `poppySchema` with `superRefine` field-validity rules. Rationale: consistent with existing actions.
- **Error mapping per section 8.13** returns `{ ok: false, error, code }` with the Poppy error code.

## Risks / Trade-offs

- [SSE streaming complexity] → Use raw `fetch` and a small SSE frame parser; keep the stream handler thin.
- [Ambiguous event dispatch] → Dispatch on the SSE `event:` field; return a clear error for unknown event types.
- [Token leakage in URLs] → Never place tokens in URLs; always use headers.
- [Schema field collisions with existing actions] → Add conversation fields with distinct names and `superRefine` rules.
