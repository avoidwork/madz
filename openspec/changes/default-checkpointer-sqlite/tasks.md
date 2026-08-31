## 1. Update Configuration Files

- [ ] 1.1 Update config.yaml — Change `mode: memory` to `mode: sqlite` at line 102
- [ ] 1.2 Update Zod schema default in src/config/schemas/persistence.js — Change `.default('memory')` to `.default('sqlite')` at line 4

## 2. Update Runtime Implementation

- [ ] 2.1 Update checkpointer.js fallback in src/session/checkpointer.js — Change `const mode = persistenceConfig.mode || 'memory'` to `const mode = persistenceConfig.mode || 'sqlite'` at line 19
- [ ] 2.2 Update JSDoc @param default in src/session/checkpointer.js — Change `@param {string} [default='memory']` to `@param {string} [default='sqlite']` at line 10

## 3. Update Tests

- [ ] 3.1 Find and read existing checkpointer tests in tests/unit/session/
- [ ] 3.2 Update tests that assume 'memory' as the default to expect 'sqlite'
- [ ] 3.3 Add a test verifying that createCheckpointer() with no arguments returns an AsyncSqliteSaver
- [ ] 3.4 Ensure tests that explicitly pass `{ mode: 'memory' }` still pass

## 4. Verify

- [ ] 4.1 Run `npm run test` and confirm all tests pass
- [ ] 4.2 Run `npm run lint` and confirm no lint errors
- [ ] 4.3 Run `npm run coverage` and confirm coverage is maintained
