## 1. Source Code Fix

- [ ] 1.1 Apply `.replace(/:/g, "-")` to `providerConfig.model` in the model identifier template literal at `src/agent/deepAgents.js:193`

## 2. Unit Tests

- [ ] 2.1 Add test case for model name with single colon
- [ ] 2.2 Add test case for model name with multiple colons
- [ ] 2.3 Add test case for model name with leading/trailing colons
- [ ] 2.4 Add test case for model name without colons (no-op)

## 3. Verification

- [ ] 3.1 Run test suite to confirm no regressions
- [ ] 3.2 Run lint to confirm formatting is clean
