## 1. Implement the browser tool

- [x] 1.1 Create `src/tools/browser/index.js` with a `browser` tool (LangChain `tool()`) and a Zod discriminated schema keyed on `action`
- [x] 1.2 Implement the `navigate` action using `page.goto` with URL validation via `filterUrl`
- [x] 1.3 Implement the `click` action using `page.click`
- [x] 1.4 Implement the `type` and `fill` actions using `page.type` (fill clears existing value)
- [x] 1.5 Implement the `press` action using `page.keyboard.press`
- [x] 1.6 Implement the `screenshot` action returning base64 via `page.screenshot`
- [x] 1.7 Implement the `extract` action returning `document.body.innerText`
- [x] 1.8 Implement the `waitFor` action (selector or network idle)
- [x] 1.9 Implement the `evaluate` action using `page.evaluate`
- [x] 1.10 Ensure the browser is closed in a `finally` block on every call

## 2. Register the tool

- [x] 2.1 Add `browser: ["network:outbound"]` to `TOOL_PERMISSIONS` in `src/tools/index.js`
- [x] 2.2 Add `browser` to `TOOL_CLASSIFICATIONS` in `src/tools/index.js`
- [x] 2.3 Add `browser` to the `TOOLS` map in `src/tools/index.js`
- [x] 2.4 Add a `case "browser":` branch in the `buildToolConfig` switch gated on `hasAllPerms`

## 3. Tests

- [x] 3.1 Write `tests/unit/tools/browser.test.js` covering Zod schema validation for all actions and inputs
- [ ] 3.2 Write `tests/integration/tools/browser.test.js` covering navigate/click/fill/extract against a local fixture page
- [x] 3.3 Cover edge cases: invalid URL, selector not found, timeout, invalid action
