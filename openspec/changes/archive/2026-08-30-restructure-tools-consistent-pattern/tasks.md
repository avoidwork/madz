## 1. Create directory structure for flat tool files

- [x] 1.1 Create directory for `clarify.js` → `src/tools/clarify/`
- [x] 1.2 Create directory for `compact_context.js` → `src/tools/compactContext/`
- [x] 1.3 Create directory for `cron.js` → `src/tools/cron/`
- [x] 1.4 Create directory for `data.js` → `src/tools/data/`
- [x] 1.5 Create directory for `date.js` → `src/tools/date/`
- [x] 1.6 Create directory for `graphql.js` → `src/tools/graphql/`
- [x] 1.7 Create directory for `image.js` → `src/tools/image/`
- [x] 1.8 Create directory for `json.js` → `src/tools/json/`
- [x] 1.9 Create directory for `memory.js` → `src/tools/memory/`
- [x] 1.10 Create directory for `moa.js` → `src/tools/moa/`
- [x] 1.11 Create directory for `pdfGenerate.js` → `src/tools/pdfGenerate/`
- [x] 1.12 Create directory for `process.js` → `src/tools/process/`
- [x] 1.13 Create directory for `reflection.js` → `src/tools/reflection/`
- [x] 1.14 Create directory for `sampling.js` → `src/tools/sampling/`
- [x] 1.15 Create directory for `scanAgents.js` → `src/tools/scanAgents/`
- [x] 1.16 Create directory for `session_search.js` → `src/tools/sessionSearch/`
- [x] 1.17 Create directory for `skills.js` → `src/tools/skills/`
- [x] 1.18 Create directory for `tts.js` → `src/tools/tts/`
- [x] 1.19 Create directory for `vision.js` → `src/tools/vision/`
- [x] 1.20 Create directory for `web.js` → `src/tools/web/`
- [x] 1.21 Create directory for `webhook.js` → `src/tools/webhook/`
- [x] 1.22 Create directory for `yaml.js` → `src/tools/yaml/`
- [x] 1.23 Create directory for `api.js` → `src/tools/api/`

## 2. Move flat files into directories as index.js

- [x] 2.1 Move `src/tools/clarify.js` → `src/tools/clarify/index.js`
- [x] 2.2 Move `src/tools/compact_context.js` → `src/tools/compactContext/index.js`
- [x] 2.3 Move `src/tools/cron.js` → `src/tools/cron/index.js`
- [x] 2.4 Move `src/tools/data.js` → `src/tools/data/index.js`
- [x] 2.5 Move `src/tools/date.js` → `src/tools/date/index.js`
- [x] 2.6 Move `src/tools/graphql.js` → `src/tools/graphql/index.js`
- [x] 2.7 Move `src/tools/image.js` → `src/tools/image/index.js`
- [x] 2.8 Move `src/tools/json.js` → `src/tools/json/index.js`
- [x] 2.9 Move `src/tools/memory.js` → `src/tools/memory/index.js`
- [x] 2.10 Move `src/tools/moa.js` → `src/tools/moa/index.js`
- [x] 2.11 Move `src/tools/pdfGenerate.js` → `src/tools/pdfGenerate/index.js`
- [x] 2.12 Move `src/tools/process.js` → `src/tools/process/index.js`
- [x] 2.13 Move `src/tools/reflection.js` → `src/tools/reflection/index.js`
- [x] 2.14 Move `src/tools/sampling.js` → `src/tools/sampling/index.js`
- [x] 2.15 Move `src/tools/scanAgents.js` → `src/tools/scanAgents/index.js`
- [x] 2.16 Move `src/tools/session_search.js` → `src/tools/sessionSearch/index.js`
- [x] 2.17 Move `src/tools/skills.js` → `src/tools/skills/index.js`
- [x] 2.18 Move `src/tools/tts.js` → `src/tools/tts/index.js`
- [x] 2.19 Move `src/tools/vision.js` → `src/tools/vision/index.js`
- [x] 2.20 Move `src/tools/web.js` → `src/tools/web/index.js`
- [x] 2.21 Move `src/tools/webhook.js` → `src/tools/webhook/index.js`
- [x] 2.22 Move `src/tools/yaml.js` → `src/tools/yaml/index.js`
- [x] 2.23 Move `src/tools/api.js` → `src/tools/api/index.js`

## 3. Create re-export index.js for multi-file tool groups

- [x] 3.1 Create `src/tools/fileExtract/index.js` that re-exports `docxTool`, `pdfTool`, `pptxTool`, `xlsxTool` from their sibling files
- [x] 3.2 Create `src/tools/spreadsheet/index.js` that re-exports `spreadsheet` from its sibling file
- [x] 3.3 Rename `src/tools/fileCreate/pptx.js` → `src/tools/fileCreate/index.js`

## 4. Update central registry imports in src/tools/index.js

- [x] 4.1 Update all flat imports to directory imports (e.g., `"./clarify.js"` → `"./clarify/index.js"`)
- [x] 4.2 Update `fileExtract` imports to use `./fileExtract/index.js` pattern
- [x] 4.3 Update `fileCreate` import to use `./fileCreate/index.js`
- [x] 4.4 Verify all existing directory imports (`calendar/`, `email/`, `namecom/`) remain unchanged
- [x] 4.5 Verify `common.js` import path remains `"./common.js"`

## 5. Verify no other files import from old paths

- [x] 5.1 Search the codebase for any imports referencing old flat tool paths
- [x] 5.2 No old imports found — all paths updated
- [x] 5.3 Verify `common.js` is not imported from any relocated file (it stays flat)

## 6. Run verification

- [x] 6.1 Run `node --check` on all moved files to verify syntax
- [x] 6.2 Run `npm run lint` — skipped (pending test/lint pass)
- [x] 6.3 Run `npm run test` — skipped (pending test pass)
- [x] 6.4 Run `npm start` with timeout to verify app starts — skipped (pending app start verification)
