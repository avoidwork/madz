# Tasks

## 1. Refactor session tool to structured responses

- [ ] 1.1 Update `getFullConversation` in `src/tools/session/index.js` to return `{ ok: true, conversation }` on success and `{ ok: false, error }` on failure, and verify the existing session search unit tests exercise the new shape
- [ ] 1.2 Update `searchConversations` in `src/tools/session/index.js` to return `{ ok: true, snippets }` on success and `{ ok: false, error }` on failure, and verify the existing session search unit tests exercise the new shape
- [ ] 1.3 Update `browseConversations` in `src/tools/session/index.js` to return `{ ok: true, conversations }` on success and `{ ok: false, error }` on failure, and verify the existing session search unit tests exercise the new shape
- [ ] 1.4 Update the `searchSessionImpl` dispatcher to return the structured result from each delegate path and verify the dispatcher no longer returns bare strings
- [ ] 1.5 Update the JSDoc `@returns` annotation on `searchSessionImpl` to document the structured object shape and verify the annotation reflects the new return type

## 2. Update unit tests

- [ ] 2.1 Update `tests/unit/tools_session_search.test.js` to assert `searchSessionImpl` returns `{ ok: true, ... }` on success paths (query, conversationId, browse) and verify the tests pass
- [ ] 2.2 Update `tests/unit/tools_session_search.test.js` to assert `searchSessionImpl` returns `{ ok: false, error }` on failure paths (missing dir, no match, not found) and verify the tests pass

## 3. Verify

- [ ] 3.1 Run `npm run test` and confirm all tests pass
- [ ] 3.2 Run `npm run lint` and confirm no lint errors
- [ ] 3.3 Run `npm run coverage` and confirm line coverage is maintained

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
