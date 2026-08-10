## 1. Create process.js with process management code

- [ ] 1.1 Create `src/tools/process.js` with `processTracker`, `trackProcess`, `manageProcessImpl`, and `processTool`
- [ ] 1.2 Ensure `process.js` has all necessary imports (tool, z, logger)

## 2. Refactor shell.js to remove process management code

- [ ] 2.1 Remove `processTracker`, `trackProcess`, `manageProcessImpl`, and `processTool` from `src/tools/shell.js`
- [ ] 2.2 Add import for `trackProcess` from `./process.js` (needed by `executeBackground`)
- [ ] 2.3 Verify shell.js still exports `executeShellImpl` and `shell`

## 3. Update index.js exports

- [ ] 3.1 Add export of `processTracker`, `trackProcess`, `manageProcessImpl`, `processTool` from `./process.js` in `src/tools/index.js`
- [ ] 3.2 Verify all previous exports still work

## 4. Update consumers

- [ ] 4.1 Find all files importing `processTracker`, `trackProcess`, `manageProcessImpl`, or `processTool` from `shell.js`
- [ ] 4.2 Update import paths to use `./process.js`
- [ ] 4.3 Verify no remaining imports of these names from `shell.js`

## 5. Verify shell.js size

- [ ] 5.1 Confirm `src/tools/shell.js` is under 120 lines
- [ ] 5.2 Confirm `src/tools/process.js` contains all process management code

## 6. Test

- [ ] 6.1 Run `npm test` to verify all tests pass
- [ ] 6.2 Run `npm start` with timeout to verify application starts
