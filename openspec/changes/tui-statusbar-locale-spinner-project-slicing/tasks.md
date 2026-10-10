## 1. Config: Add contextWindow field

- [ ] 1.1 Add `contextWindow: z.number().int().positive().default(128000)` to `OpenaiProviderConfigSchema` in `src/config/schemas/providers.js`
- [ ] 1.2 Add `contextWindow: z.number().int().positive().default(128000)` to `CopilotProviderConfigSchema` in `src/config/schemas/providers.js`
- [ ] 1.3 Add `contextWindow: 128000` under `providers.openai` in `config.yaml`
- [ ] 1.4 Add `contextWindow: 128000` under `providers.copilot` in `config.yaml`

## 2. Runtime: Update contextWindow from model context length

- [ ] 2.1 In `src/agent/deepAgents.js`, in the block that resolves `contextLength` and mutates `config.summarization.trigger`, also update the active provider's `contextWindow` field with the resolved context length when `contextLength !== undefined`

## 3. TUI: Thread contextWindow to StatusBar

- [ ] 3.1 In `src/tui/app.js`, derive `contextWindow` from `activeProvider?.contextWindow || 0` and pass it to `InputArea`
- [ ] 3.2 In `src/tui/inputArea.js`, accept a `contextWindow` prop (default 0) and forward it to the `StatusBar`

## 4. StatusBar: Locale, spinner color, project slicing

- [ ] 4.1 In `src/tui/statusBar.js`, replace `Intl.DateTimeFormat().resolvedOptions().locale` with a module-level cached `Intl.NumberFormat().resolvedOptions().locale` in `formatNumber` and `formatSize`
- [ ] 4.2 In `src/tui/statusBar.js`, add a `contextWindow` prop (default 0) and a `getContextUtilizationColor(contextSize, contextWindow)` helper; use it for the streaming spinner's color
- [ ] 4.3 In `src/tui/statusBar.js`, replace the `project.includes("projects/")` + `lastIndexOf` string match with `path.basename()` (import `node:path`), preserving the full-path fallback

## 5. Tests

- [ ] 5.1 Update `tests/unit/tui/statusBar.test.js` for the locale and project-slicing changes
- [ ] 5.2 Add tests for `getContextUtilizationColor` covering the boundary thresholds (60/61, 80/81, 100) and the no-budget fallback
