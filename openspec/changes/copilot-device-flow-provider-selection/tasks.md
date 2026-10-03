## 1. Implementation

- [ ] 1.1 Import `getActiveProviderName` from `./src/provider/openai.js` in `index.js`
- [ ] 1.2 Replace the raw first-key provider lookup in `index.js` with `getActiveProviderName(config)`
- [ ] 1.3 Verify the `if (activeProvider.type === "github-copilot")` guard still gates the device flow correctly

## 2. Testing

- [ ] 2.1 Add a regression test in `tests/unit/provider/openai.test.js` verifying that when copilot is enabled but not the first provider key, `getActiveProviderName` returns `copilot`
- [ ] 2.2 Run `npm run test` and `npm run coverage` to confirm no regressions
