## 1. Tool Module

- [ ] 1.1 Create `src/tools/browser/index.js` with a `browser` tool and a Zod discriminated union schema keyed on `action`
- [ ] 1.2 Implement the `navigate` action (validate URL via `filterUrl`, open page, goto)
- [ ] 1.3 Implement the `click` action (click a selector)
- [ ] 1.4 Implement the `type`/`fill` action (enter text into a selector)
- [ ] 1.5 Implement the `press` action (press a keyboard key)
- [ ] 1.6 Implement the `screenshot` action (return base64 image)
- [ ] 1.7 Implement the `extract` action (return page text)
- [ ] 1.8 Implement the `waitFor` action (wait for selector or network idle)
- [ ] 1.9 Implement the `evaluate` action (run JS in page context)
- [ ] 1.10 Ensure the browser is closed in a `finally` block on every path

## 2. Registration

- [ ] 2.1 Add `browser: ["network:outbound"]` to `TOOL_PERMISSIONS` in `src/tools/index.js`
- [ ] 2.2 Add `browser: ["search", "research", "coding"]` to `TOOL_CLASSIFICATIONS` in `src/tools/index.js`
- [ ] 2.3 Add `browser` to the `TOOLS` map in `src/tools/index.js`
- [ ] 2.4 Add a `case "browser"` to the `buildToolConfig` switch in `src/tools/index.js`

## 3. Tests

- [ ] 3.1 Add `tests/unit/tools/browser.test.js` covering schema validation for all actions and URL rejection
- [ ] 3.2 Add `tests/integration/tools/browser.test.js` covering navigate, click, fill, and extract against a local fixture page

## 4. Verification

- [ ] 4.1 Run `npm run test` and confirm all tests pass
- [ ] 4.2 Run `npm run lint` and confirm lint passes
- [ ] 4.3 Run `npm run coverage` and confirm coverage is maintained
