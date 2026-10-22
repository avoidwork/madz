## 1. clarify tool

- [x] 1.1 Import `loadConfig` and `join` in `src/tools/clarify/index.js`
- [x] 1.2 Change the `clarificationsFile` fallback to read `config.memory.toolsDir` (default `memory/tools/`) via `loadConfig()`, preserving the `options.clarificationsFile` override
- [x] 1.3 Update the `clarify` tool description (line 84) to reference `memory/tools/`

## 2. generatePptx tool

- [x] 2.1 Import `loadConfig` in `src/tools/pptx/index.js`
- [x] 2.2 Make `outputPath` optional in `generatePptxSchema` and default it to `join(config.memory.toolsDir, ...)` when omitted in `createPptx`
- [x] 2.3 Preserve the `validateOutputPath` traversal guard on the resolved path

## 3. generatePdf tool

- [x] 3.1 Import `loadConfig` and `join` in `src/tools/pdf/index.js`
- [x] 3.2 Default `outputPath` to `config.memory.toolsDir` when omitted in the action handlers

## 4. spreadsheet tool

- [x] 4.1 Import `loadConfig` and `join` in `src/tools/spreadsheet/spreadsheet.js`
- [x] 4.2 Default `outputPath` to `config.memory.toolsDir` when omitted in `generate`/`modify`/`export`

## 5. tts tool

- [x] 5.1 Replace `join(homedir(), "voice-memos")` with `join(config.cwd, config.memory.toolsDir)` in `src/tools/tts/index.js`
- [x] 5.2 Remove the now-unused `homedir` import
- [x] 5.3 Update the `textToSpeech` tool description to reference `memory/tools/`

## 6. SYSTEM_PROMPT.md fallback directive

- [x] 6.1 Add a rule to `prompts/SYSTEM_PROMPT.md` stating tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself

## 7. Tests

- [x] 7.1 Adjust `tests/unit/tools_clarify.test.js` if it asserts the old `memory/context/clarifications.md` path
- [x] 7.2 Add regression tests asserting each tool defaults to `config.memory.toolsDir`
- [x] 7.3 Add a regression test asserting `loadContext()` no longer includes `clarifications.md`
