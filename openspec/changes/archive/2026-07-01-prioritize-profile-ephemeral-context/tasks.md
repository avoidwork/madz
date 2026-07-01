## 1. Add ephemeral limit config

- [ ] 1.1 Add `memory.ephemeralLimit` to config schema in `src/config/schemas.js` with default value of 5
- [ ] 1.2 Verify config loader reads the new option from `config.yaml`

## 2. Refactor loadContext to filter ephemeral files

- [ ] 2.1 Add filter in the main file processing loop to skip files whose name starts with `ephemeral`
- [ ] 2.2 Verify `profile.md` is still loaded first (existing behavior)
- [ ] 2.3 Verify non-ephemeral files are processed in existing timestamp order

## 3. Add ephemeral memory loading as final step

- [ ] 3.1 After main processing loop, read memory directory and filter for files starting with `ephemeral`
- [ ] 3.2 Sort ephemeral files by modification timestamp descending (newest first)
- [ ] 3.3 Load up to `memory.ephemeralLimit` ephemeral files (default 5)
- [ ] 3.4 Append ephemeral content to context output after persistent context
- [ ] 3.5 Handle edge case: no ephemeral files exist (graceful no-op)

## 4. Wire context into system prompt

- [ ] 4.1 In `src/memory/prompts.js`, call `loadContext()` within `loadSystemPrompt`
- [ ] 4.2 Append the context output to the end of `SYSTEM_PROMPT.md` content
- [ ] 4.3 Handle edge case: `loadContext` returns empty string (return prompt unchanged)

## 5. Write tests

- [ ] 5.1 Test `loadContext` loads `profile.md` first
- [ ] 5.2 Test `loadContext` filters out ephemeral files from main processing
- [ ] 5.3 Test `loadContext` loads ephemeral files last with correct sort order
- [ ] 5.4 Test `loadContext` respects ephemeral limit
- [ ] 5.5 Test `loadContext` handles missing `profile.md` gracefully
- [ ] 5.6 Test `loadContext` handles no ephemeral files gracefully
- [ ] 5.7 Test `loadSystemPrompt` appends context to system prompt
- [ ] 5.8 Test `loadSystemPrompt` handles empty context gracefully

## 6. Verify and commit

- [ ] 6.1 Run `npm run test` and verify all tests pass
- [ ] 6.2 Run `npm run lint` and verify no lint errors
- [ ] 6.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 6.4 Verify application starts without crashing (`npm start`)