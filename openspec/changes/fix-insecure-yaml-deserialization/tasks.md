## 1. Implementation

- [ ] 1.1 Replace `yaml.load(fileContent)` with `yaml.safeLoad(fileContent)` in `src/config/loader.js` at line 139
- [ ] 1.2 Add a comment explaining the security rationale for using safe YAML parsing

## 2. Testing

- [ ] 2.1 Add unit tests for malicious YAML input (e.g., `!!js/function` tags)
- [ ] 2.2 Add unit tests for edge cases (empty config, malformed YAML)
- [ ] 2.3 Verify existing config loading still works with the safe parser

## 3. Verification

- [ ] 3.1 Run existing test suite and verify all tests pass
- [ ] 3.2 Run lint checks and verify no lint errors
- [ ] 3.3 Verify coverage is maintained