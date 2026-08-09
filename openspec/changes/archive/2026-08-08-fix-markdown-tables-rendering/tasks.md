## 1. Implement Fix

- [ ] 1.1 Fix `generateTableRow()` regex in `src/tui/markdownText.js` line 195: change `/\^[*]+\|[*^]/` to `/\^[*]+\|[|]+[*^]/`

## 2. Update Spec

- [ ] 2.1 Add delta spec to `specs/terminal-renderer/spec.md` documenting the table delimiter contract

## 3. Verify

- [ ] 3.1 Run `npm run lint` to verify code passes checks
- [ ] 3.2 Run `npm run test` to verify all tests pass
- [ ] 3.3 Verify table rendering works with a manual test

## 4. Commit and Push

- [ ] 4.1 Stage changes
- [ ] 4.2 Commit with conventional commit format
- [ ] 4.3 Push branch to remote
- [ ] 4.4 Create PR targeting main
