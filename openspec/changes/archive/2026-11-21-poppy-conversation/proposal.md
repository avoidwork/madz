# Proposal

## Why

Poppy lets a personal agent get work done with a company's agent. The agent starts a conversation, sends messages, reads and streams events, and can hand off to a person or open a direct conversation. This is the second primary channel for getting tasks done and builds on the previously merged Poppy features (discovery, agent identity, session signing, OAuth, session verification, API integration).

## What Changes

- Add a new `conversation` action to the `poppy` tool that starts a conversation with a company's agent via `POST {endpoint}`, sends messages via `POST {endpoint}/{id}/messages`, and reads events via `GET {endpoint}/{id}/events`.
- Support streaming with SSE (`Accept: text/event-stream`), handling `message`, `state`, `authorization`, `user_requested`, `direct_opened`, `direct_closed`, `working`, and `text-delta` events.
- Handle request IDs for safe retries and the `wait`/`cursor` query parameters.
- Support handoff to a person (`POST {endpoint}/{id}/handoff` and `/handoff/cancel`).
- Support direct conversations (`parent_conversation_id`, `user_requested_event_id`).
- Handle conversation state fields: `working`, `handoff`, `responder`, `closed`.
- Handle conversation errors per Poppy spec section 8.13.

## Capabilities

### New Capabilities
- `poppy-conversation`: Starting, sending, reading, and streaming messages with a company's agent over the Poppy conversation protocol, including handoff to a person and direct conversations.

### Modified Capabilities
<!-- No existing capability requirements change. -->

## Impact

- `src/tools/poppy/conversation.js` (new) — the `conversation` action module.
- `src/tools/poppy/index.js` (modified) — register `conversation` in `ACTIONS`, add `"conversation"` to the action enum, add conversation fields to `poppySchema`.
- `tests/unit/tools/poppy/conversation.test.js` (new) — unit tests.
- `tests/integration/tools/poppy/conversation.test.js` (new) — integration tests.
- Dependencies: `jose` (already present), `undici` (already present as a transitive dependency; Node's `fetch` suffices for SSE).

## Non-goals

- Modifying the existing `discover`, `identity`, `session`, `oauth`, `verify`, or `api` actions beyond registering the new `conversation` action.
- Re-expanding the `poppy` tool's `description` (it stays slimmed).
- Implementing a full Poppy client library beyond the conversation action.
