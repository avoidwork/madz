## 1. Update Config Default

- [x] 1.1 Change `recursionLimit` default from 30 to 1000 in `src/config/schemas.js`
- [x] 1.2 Update any comments or documentation referencing the old default value

## 2. Update Tests

- [x] 2.1 Find and update any tests that assert or assume a recursion limit of 30
- [x] 2.2 Add a test verifying the default recursion limit is 1000

## 3. Verify

- [x] 3.1 Run full test suite and confirm all tests pass
- [x] 3.2 Run lint check and confirm no issues
