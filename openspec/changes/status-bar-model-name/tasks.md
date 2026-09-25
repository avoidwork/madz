## 1. Implementation

- [ ] 1.1 Extract the active provider selection into a shared helper (e.g., `getActiveModelName(config)`) and use it in `src/agent/deepAgents.js`
- [ ] 1.2 Populate `appInfo.model` in `index.js` using the helper
- [ ] 1.3 Thread `model` from `appInfo` through `src/tui/inputArea.js` to the `StatusBar`
- [ ] 1.4 Render `[🧠 <model>]` in `src/tui/statusBar.js` right-hand box, only when a model is configured

## 2. Testing

- [ ] 2.1 Add unit tests for the helper (returns correct model name, falls back to openai) and the StatusBar render (renders model when configured, omits when not configured)
- [ ] 2.2 Verify `npm run test`, `npm run lint`, and `npm run coverage` pass
