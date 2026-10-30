# Proposal

## Why

The `searchSession` tool's `searchSessionImpl` currently returns bare strings (e.g. `Conversation (file):\n\n<body>` and `Found N matching snippets...`). This is inconsistent with the structured-object convention used elsewhere in the codebase. Returning a structured object makes the response self-describing and lets consumers distinguish success from failure without parsing.

## What Changes

- `searchSessionImpl` in `src/tools/session/index.js` will return a native structured object instead of a bare string.
- On success, return `{ ok: true, ... }` (e.g. `{ ok: true, conversation }`, `{ ok: true, snippets }`, `{ ok: true, conversations }`).
- On failure, return `{ ok: false, error: <message> }`.
- The three delegate helpers (`getFullConversation`, `searchConversations`, `browseConversations`) will be updated to return structured objects.
- The JSDoc `@returns` annotation on `searchSessionImpl` will be updated to reflect the new shape.
- Unit tests in `tests/unit/tools_session_search.test.js` will be updated to assert the new object shape.

## Capabilities

### New Capabilities
- `session-search-tool`: The `searchSession` tool's structured response contract — the tool SHALL return `{ ok: true, ... }` on success and `{ ok: false, error }` on failure across all three delegate paths (conversationId, query, browse).

### Modified Capabilities
- None.

## Impact

- `src/tools/session/index.js` — the dispatcher and three helper functions.
- `tests/unit/tools_session_search.test.js` — existing unit tests updated to assert the new object shape.
- No new packages or dependencies. No changes to the `searchSession` zod schema or tool registration.

## Non-goals

- No changes to other tools.
- No changes to the `searchSession` zod schema or tool registration.
- No new behavior beyond the response shape change.
