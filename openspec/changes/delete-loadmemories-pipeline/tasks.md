## 1. Delete loadMemories Files

- [ ] 1.1 Delete `src/memory/loadMemories.js` entirely
- [ ] 1.2 Delete `tests/unit/memories.test.js` entirely

## 2. Remove References from index.js

- [ ] 2.1 Remove `loadMemories` and `formatMemoriesForPrompt` from imports (line 143)
- [ ] 2.2 Remove `loadMemories()` and `formatMemoriesForPrompt()` calls from `callProvider()` (lines 244-245)
- [ ] 2.3 Remove `${memoryText ? ...}` from the `callPrompt` template string (line 248)
- [ ] 2.4 Remove `loadMemories` and `formatMemoriesForPrompt` from module exports (lines 437-438)

## 3. Remove References from src/memory/index.js

- [ ] 3.1 Remove `loadMemories`, `formatMemoriesForPrompt`, `parseEntryFile` exports (line 5)

## 4. Remove Config Reference

- [ ] 4.1 Remove `memory.entriesDir` from config schema in `src/config/schemas.js`
- [ ] 4.2 Remove `memory.entriesDir` from `config.yaml`

## 5. Verify

- [ ] 5.1 Run `npm run test` — all tests pass
- [ ] 5.2 Run `npm run lint` — no lint errors
- [ ] 5.3 Verify `loadContext` still works (tests in `tests/unit/context.test.js`)
- [ ] 5.4 Verify application starts (`npm start`)