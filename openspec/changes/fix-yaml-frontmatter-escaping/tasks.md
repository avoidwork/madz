## 1. Implement escapeYamlString helper

- [ ] 1.1 Add escapeYamlString() function to src/memory/writer.js that escapes backslashes (\\ → \\\\), double quotes (" → \\"), and newlines (\\n → \\\\n) in the correct order
- [ ] 1.2 Apply escapeYamlString() to the title field on line 27 of writeMemoryFile
- [ ] 1.3 Apply escapeYamlString() to string frontmatter values on line 31 of writeMemoryFile

## 2. Update tests

- [ ] 2.1 Update the buildMemoryContent test helper in tests/unit/memory.test.js to use the same escapeYamlString logic
- [ ] 2.2 Add unit test for title containing double quotes
- [ ] 2.3 Add unit test for title containing backslashes
- [ ] 2.4 Add unit test for title containing newlines
- [ ] 2.5 Add unit test for frontmatter string values with special characters

## 3. Verify

- [ ] 3.1 Run full test suite (npm run test) and verify all tests pass
- [ ] 3.2 Run lint (npm run lint) and verify no lint errors
- [ ] 3.3 Verify application starts without crashing (npm start)