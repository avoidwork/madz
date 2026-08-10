## 1. Move ensureSessionsDir to factory.js

- [ ] 1.1 Extract `ensureSessionsDir` function from `src/session/index.js`
- [ ] 1.2 Add `ensureSessionsDir` to `src/session/factory.js`
- [ ] 1.3 Remove the export of `ensureSessionsDir` from `src/session/index.js`

## 2. Update consumers

- [ ] 2.1 Find all files importing `ensureSessionsDir` from the session barrel
- [ ] 2.2 Update import paths to use `src/session/factory.js`
- [ ] 2.3 Verify no remaining imports of `ensureSessionsDir` from `index.js`

## 3. Verify index.js is a pure barrel

- [ ] 3.1 Confirm `src/session/index.js` contains only re-exports
- [ ] 3.2 No standalone function definitions remain in index.js

## 4. Test

- [ ] 4.1 Run `npm test` to verify all tests pass
- [ ] 4.2 Run `npm start` with timeout to verify application starts
