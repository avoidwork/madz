## 1. Rename the file

- [ ] 1.1 Rename `src/memory/expireEphemeral.js` → `src/memory/expireEphemeralMemories.js` using `git mv`

## 2. Update imports

- [ ] 2.1 Update import in `src/memory/context.js` from `./expireEphemeral.js` to `./expireEphemeralMemories.js`
- [ ] 2.2 Update export in `src/memory/index.js` from `./expireEphemeral.js` to `./expireEphemeralMemories.js`

## 3. Verify no remaining references

- [ ] 3.1 Search entire codebase for `expireEphemeral.js` — confirm zero matches
- [ ] 3.2 Search entire codebase for `from.*expireEphemeral` — confirm zero matches

## 4. Test

- [x] 4.1 Run `npm test` to verify all tests pass
- [x] 4.2 Run `npm start` with timeout to verify application starts
