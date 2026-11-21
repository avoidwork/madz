# Tasks

## 1. Scaffolding

- [x] 1.1 Create `src/tools/poppy/conversation.js` exporting an `execute` function and verify the module imports without error
- [x] 1.2 Register the `conversation` action in `ACTIONS` and add `"conversation"` to the action enum plus conversation fields in `poppySchema` in `src/tools/poppy/index.js`, and verify `npm run lint` passes

## 2. Start Conversation

- [x] 2.1 Implement the `start` op (`POST {endpoint}`) accepting optional `parent_conversation_id` and `user_requested_event_id`, and verify unit tests cover start success, missing endpoint, and non-HTTPS rejection

## 3. Send Messages

- [x] 3.1 Implement the `send` op (`POST {endpoint}/{id}/messages`) with request ID support, and verify unit tests cover send success and request ID handling

## 4. Read Events

- [x] 4.1 Implement the `read` op (`GET {endpoint}/{id}/events`) with `wait`/`cursor` query parameters, and verify unit tests cover read success and wait/cursor params

## 5. Stream Events via SSE

- [x] 5.1 Implement the `stream` op (`GET {endpoint}/{id}/events` with `Accept: text/event-stream`) using raw `fetch`, parsing SSE frames and dispatching `message`, `state`, `authorization`, `user_requested`, `direct_opened`, `direct_closed`, `working`, and `text-delta` events, and verify unit tests cover SSE parsing and each event type

## 6. Handoff to a Person

- [x] 6.1 Implement the `handoff` op (`POST {endpoint}/{id}/handoff`) and `handoff_cancel` op (`POST {endpoint}/{id}/handoff/cancel`), and verify unit tests cover handoff and handoff_cancel

## 7. Conversation State and Errors

- [x] 7.1 Handle conversation state fields `working`, `handoff`, `responder`, `closed`, and verify unit tests cover state handling
- [x] 7.2 Implement section 8.13 error mapping (`conversation_not_found`, `conversation_closed`, `direct_conversation_open`, `request_id_conflict`, `invalid_cursor`, `cursor_expired`, `version_mismatch`) and verify unit tests cover each mapping

## 8. Integration Tests

- [x] 8.1 Add `tests/integration/tools/poppy/conversation.test.js` running against a mock conversation server with SSE and verify the integration test passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
