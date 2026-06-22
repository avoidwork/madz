## 1. Fix YAML parse error handling in loadConfig()

- [ ] 1.1 Wrap yaml.load(fileContent) in try/catch in loader.js loadConfig()
- [ ] 1.2 On parse error: log error via console.error, fall back to DEFAULT_CONFIG
- [ ] 1.3 On success: proceed with deep merge and env resolution as before

## 2. Fix in-memory/disk divergence in setConfigValue()

- [ ] 2.1 Refactor setConfigValue() to persist to disk first via saveConfig()
- [ ] 2.2 On write success: mutate in-memory config via applyDotPathMutation()
- [ ] 2.3 On write failure: throw descriptive Error without mutating in-memory config

## 3. Remove duplicate _parseValue() from loader.js

- [ ] 3.1 Import parseValue from ./mutate.js in loader.js
- [ ] 3.2 Replace _parseValue() call in _resolveEnvRecursively() with parseValue()
- [ ] 3.3 Remove _parseValue() function definition from loader.js

## 4. Remove dead provider schemas from schemas.js

- [ ] 4.1 Remove _OpenaiProviderConfigSchema (lines 67-76)
- [ ] 4.2 Remove _OpenrouterProviderConfigSchema (lines 78-81)
- [ ] 4.3 Remove _FalProviderConfigSchema (lines 83-86)
- [ ] 4.4 Verify no references remain in ConfigSchema or DEFAULT_CONFIG

## 5. Add object guard to assignPath() in mutate.js

- [ ] 5.1 Add guard at top of assignPath() that checks obj is non-null object
- [ ] 5.2 Handle typeof null === "object" quirk explicitly
- [ ] 5.3 Throw descriptive Error for null, undefined, string, number inputs
- [ ] 5.4 Allow arrays (they are valid objects in JS)

## 6. Add tests for new behavior

- [ ] 6.1 Test: loadConfig() with malformed YAML falls back to DEFAULT_CONFIG and logs error
- [ ] 6.2 Test: assignPath() throws descriptive Error for null, undefined, string, number
- [ ] 6.3 Test: setConfigValue() does not mutate in-memory config when writeFileSync fails
- [ ] 6.4 Test: setConfigValue() works normally when write succeeds (regression)

## 7. Verify all tests pass

- [ ] 7.1 Run npm run test and verify all tests pass
- [ ] 7.2 Run npm run lint and verify no lint errors
- [ ] 7.3 Run npm run coverage and verify coverage is maintained