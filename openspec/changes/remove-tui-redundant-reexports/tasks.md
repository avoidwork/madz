## 1. Remove redundant exports from hooks.js

- [x] 1.1 Remove `nextPanel` and `prevPanel` exports from `src/tui/hooks.js`
- [x] 1.2 Verify hooks.js still exports all other necessary functions

## 2. Update hooks.js consumers

- [x] 2.1 Grep the codebase for imports of `nextPanel` or `prevPanel` from `hooks.js`
- [x] 2.2 Update import paths to use `panels.js` instead
- [x] 2.3 Verify no remaining imports of these names from `hooks.js`

## 3. Audit components.js

- [x] 3.1 Grep the entire codebase for imports of `components.js` from the tui module
- [x] 3.2 If unused: delete `src/tui/components.js`
- [x] 3.3 If used: merge its exports into `src/tui/index.js` and delete `components.js`
- [x] 3.4 Update any consumers of components.js to use index.js instead

## 4. Verify no broken imports

- [x] 4.1 Grep for any remaining imports of `hooks.js` that reference `nextPanel` or `prevPanel`
- [x] 4.2 Grep for any remaining imports of `components.js`
- [x] 4.3 Confirm zero stale imports remain

## 5. Test

- [x] 5.1 Run `npm test` to verify all tests pass
- [x] 5.2 Run `npm start` with timeout to verify application starts
