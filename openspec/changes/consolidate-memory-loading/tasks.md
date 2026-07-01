## 1. Consolidate loadMemories logic into context.js

- [ ] 1.1 Move `parseEntryFile()` helper into `src/memory/context.js`
- [ ] 1.2 Move `formatMemoriesForPrompt()` helper into `src/memory/context.js`
- [ ] 1.3 Move `getMemoryContext()` label mapping into `src/memory/context.js`
- [ ] 1.4 Add memory directory scanning logic to `loadContext()` (find .md files, sort by date)
- [ ] 1.5 Add structured entry construction to `loadContext()` (array of {key, metadata, memory})
- [ ] 1.6 Update `loadContext()` to accept a memory directory path parameter
- [ ] 1.7 Ensure `loadContext()` returns structured entries (not plain string)

## 2. Update module exports and call sites

- [ ] 2.1 Update `src/memory/index.js` to remove loadMemories exports and keep only loadContext
- [ ] 2.2 Update `index.js` to remove `loadMemories` import
- [ ] 2.3 Update `index.js` call site in `callProvider()` to use `loadContext` instead of `loadMemories`
- [ ] 2.4 Update `index.js` export of `loadMemories` at line 437

## 3. Delete loadMemories.js

- [ ] 3.1 Delete `src/memory/loadMemories.js`
- [ ] 3.2 Verify no remaining imports of loadMemories.js exist in the codebase

## 4. Migrate tests

- [ ] 4.1 Review existing tests in `tests/unit/memories.test.js`
- [ ] 4.2 Rewrite tests to use the consolidated `loadContext` function
- [ ] 4.3 Ensure tests cover: profile loading, ephemeral memory loading, context file loading, date sorting, structured entry format
- [ ] 4.4 Remove tests specific to deleted `loadMemories` exports

## 5. Verify and clean up

- [ ] 5.1 Run `npm run test` and ensure all tests pass
- [ ] 5.2 Run `npm run lint` and ensure no lint errors
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 5.4 Verify application starts with `timeout 10 npm start`