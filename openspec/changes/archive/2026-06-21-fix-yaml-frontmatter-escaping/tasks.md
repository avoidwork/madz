## 1. Implement escapeYamlString helper

- [x] 1.1 Add escapeYamlString() function to src/session/saver.js that escapes backslashes (\\ → \\\\), double quotes (" → \\"), and newlines (\n → \\n) in the correct order
- [x] 1.2 Apply escapeYamlString() to string frontmatter values in the metadata object (lines 28-34)

## 2. Update tests

- [x] 2.1 Add unit test for string values containing double quotes
- [x] 2.2 Add unit test for string values containing backslashes
- [x] 2.3 Add unit test for string values containing newlines
- [x] 2.4 Add unit test for normal string values (no special characters) to ensure no regression

## 3. Verify

- [x] 3.1 Run full test suite (npm run test) and verify all tests pass
- [x] 3.2 Run lint (npm run lint) and verify no lint errors
- [x] 3.3 Verify application starts without crashing (npm start)