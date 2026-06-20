## 1. Implementation

- [x] 1.1 Change `_rules` to `resources` in `src/sandbox/runner.js` line 125
- [x] 1.2 Add `--permission` flag to `execArgv` when spawning Node.js scripts with non-empty permissions
- [x] 1.3 Ensure `--permission` flag is only added for `.js`, `.mjs`, `.ts` extensions

## 2. Testing

- [x] 2.1 Update existing test at line 412-424 to verify permissions are applied to spawned process
- [x] 2.2 Add test for Node.js script with permissions receiving `--permission` flag
- [x] 2.3 Add test for non-Node.js script not receiving `--permission` flag

## 3. Verification

- [ ] 3.1 Run full test suite (`npm run test`)
- [ ] 3.2 Run lint (`npm run lint`)
- [ ] 3.3 Run coverage (`npm run coverage`)