## 1. clarify tool

- [ ] 1.1 Import `loadConfig` and `join` in `src/tools/clarify/index.js`
- [ ] 1.2 Change the `clarificationsFile` fallback to read `config.memory.toolsDir` (default `memory/tools/`) via `loadConfig()`, preserving the `options.clarificationsFile` override
- [ ] 1.3 Update the `clarify` tool description (line 84) to reference `memory/tools/`

## 2. generatePptx tool

- [ ] 2.1 Import `loadConfig` in `src/tools/pptx/index.js`
- [ ] 2.2 Make `outputPath` optional in `generatePptxSchema` and default it to `join(config.memory.toolsDir, ...)` when omitted in `createPptx`
- [ ] 2.3 Preserve the `validateOutputPath` traversal guard on the resolved path

## 3. generatePdf tool

- [ ] 3.1 Import `loadConfig` and `join` in `src/tools/pdf/index.js`
- [ ] 3.2 Default `outputPath` to `config.memory.toolsDir` when omitted in the action handlers

## 4. spreadsheet tool

- [ ] 4.1 Import `loadConfig` and `join` in `src/tools/spreadsheet/spreadsheet.js`
- [ ] 4.2 Default `outputPath` to `config.memory.toolsDir` when omitted in `generate`/`modify`/`export`

## 5. tts tool

- [ ] 5.1 Replace `join(homedir(), "voice-memos")` with `join(config.cwd, config.memory.toolsDir)` in `src/tools/tts/index.js`
- [ ] 5.2 Remove the now-unused `homedir` import
- [ ] 5.3 Update the `textToSpeech` tool description to reference `memory/tools/`

## 6. SYSTEM_PROMPT.md fallback directive

- [ ] 6.1 Add a rule to `prompts/SYSTEM_PROMPT.md` stating tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself

## 7. Tests

- [ ] 7.1 Adjust `tests/unit/tools_clarify.test.js` if it asserts the old `memory/context/clarifications.md` path
- [ ] 7.2 Add regression tests asserting each tool defaults to `config.memory.toolsDir`
- [ ] 7.3 Add a regression test asserting `loadContext()` no longer includes `clarifications.md`
