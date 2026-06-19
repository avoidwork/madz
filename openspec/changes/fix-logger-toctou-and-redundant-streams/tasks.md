## 1. Fix TOCTOU Race Condition

- [ ] 1.1 Wrap `readFileSync` in try/catch in `getLogDirectory()` to handle file deletion between check and read
- [ ] 1.2 Ensure fallback to default Linux path when Alpine detection fails

## 2. Fix Redundant Stream Creation

- [ ] 2.1 Hoist `devNull` variable to function scope for reuse across both try/catch blocks
- [ ] 2.2 Reuse existing `devNull` reference when creating error stream fallback

## 3. Review Pino Multistream Usage

- [ ] 3.1 Check current pino version in package.json
- [ ] 3.2 Research pino.multistream deprecation status
- [ ] 3.3 Update code if multistream is deprecated, otherwise add comment noting current status

## 4. Add Unit Tests

- [ ] 4.1 Add test for Alpine release file deletion between check and read
- [ ] 4.2 Add test for Alpine release file unreadable (permission denied)
- [ ] 4.3 Add test for single devNull stream reuse when both primary streams fail
- [ ] 4.4 Add test for normal Alpine detection still working when file exists and is readable

## 5. Verify and Test

- [ ] 5.1 Run existing test suite to ensure no regressions
- [ ] 5.2 Verify all new tests pass
- [ ] 5.3 Run lint to ensure code quality