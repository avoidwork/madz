# Tasks

## 1. Reset subagent store on new session

- [ ] 1.1 In `src/tui/app.js`, import `createSubagentStore` from `./subagentStore.js` and add `setSubagentStore(createSubagentStore())` inside `handleNewSession` so the SUBAGENTS panel is cleared when a new session starts. Verify by running `npm run lint` and `npm run test`.
- [ ] 1.2 Add a regression test that populates the subagent store, invokes the new-session handler, and asserts the store is reset to empty. Verify by running `npm run test`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
