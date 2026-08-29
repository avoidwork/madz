## 1. Create directory structure for flat tool files

- [ ] 1.1 Create directory for `clarify.js` → `src/tools/clarify/`
- [ ] 1.2 Create directory for `compact_context.js` → `src/tools/compact_context/`
- [ ] 1.3 Create directory for `cron.js` → `src/tools/cron/`
- [ ] 1.4 Create directory for `data.js` → `src/tools/data/`
- [ ] 1.5 Create directory for `date.js` → `src/tools/date/`
- [ ] 1.6 Create directory for `graphql.js` → `src/tools/graphql/`
- [ ] 1.7 Create directory for `image.js` → `src/tools/image/`
- [ ] 1.8 Create directory for `json.js` → `src/tools/json/`
- [ ] 1.9 Create directory for `memory.js` → `src/tools/memory/`
- [ ] 1.10 Create directory for `moa.js` → `src/tools/moa/`
- [ ] 1.11 Create directory for `pdfGenerate.js` → `src/tools/pdfGenerate/`
- [ ] 1.12 Create directory for `process.js` → `src/tools/process/`
- [ ] 1.13 Create directory for `reflection.js` → `src/tools/reflection/`
- [ ] 1.14 Create directory for `sampling.js` → `src/tools/sampling/`
- [ ] 1.15 Create directory for `scanAgents.js` → `src/tools/scanAgents/`
- [ ] 1.16 Create directory for `session_search.js` → `src/tools/session_search/`
- [ ] 1.17 Create directory for `skills.js` → `src/tools/skills/`
- [ ] 1.18 Create directory for `tts.js` → `src/tools/tts/`
- [ ] 1.19 Create directory for `vision.js` → `src/tools/vision/`
- [ ] 1.20 Create directory for `web.js` → `src/tools/web/`
- [ ] 1.21 Create directory for `webhook.js` → `src/tools/webhook/`
- [ ] 1.22 Create directory for `yaml.js` → `src/tools/yaml/`
- [ ] 1.23 Create directory for `api.js` → `src/tools/api/`

## 2. Move flat files into directories as index.js

- [ ] 2.1 Move `src/tools/clarify.js` → `src/tools/clarify/index.js`
- [ ] 2.2 Move `src/tools/compact_context.js` → `src/tools/compact_context/index.js`
- [ ] 2.3 Move `src/tools/cron.js` → `src/tools/cron/index.js`
- [ ] 2.4 Move `src/tools/data.js` → `src/tools/data/index.js`
- [ ] 2.5 Move `src/tools/date.js` → `src/tools/date/index.js`
- [ ] 2.6 Move `src/tools/graphql.js` → `src/tools/graphql/index.js`
- [ ] 2.7 Move `src/tools/image.js` → `src/tools/image/index.js`
- [ ] 2.8 Move `src/tools/json.js` → `src/tools/json/index.js`
- [ ] 2.9 Move `src/tools/memory.js` → `src/tools/memory/index.js`
- [ ] 2.10 Move `src/tools/moa.js` → `src/tools/moa/index.js`
- [ ] 2.11 Move `src/tools/pdfGenerate.js` → `src/tools/pdfGenerate/index.js`
- [ ] 2.12 Move `src/tools/process.js` → `src/tools/process/index.js`
- [ ] 2.13 Move `src/tools/reflection.js` → `src/tools/reflection/index.js`
- [ ] 2.14 Move `src/tools/sampling.js` → `src/tools/sampling/index.js`
- [ ] 2.15 Move `src/tools/scanAgents.js` → `src/tools/scanAgents/index.js`
- [ ] 2.16 Move `src/tools/session_search.js` → `src/tools/session_search/index.js`
- [ ] 2.17 Move `src/tools/skills.js` → `src/tools/skills/index.js`
- [ ] 2.18 Move `src/tools/tts.js` → `src/tools/tts/index.js`
- [ ] 2.19 Move `src/tools/vision.js` → `src/tools/vision/index.js`
- [ ] 2.20 Move `src/tools/web.js` → `src/tools/web/index.js`
- [ ] 2.21 Move `src/tools/webhook.js` → `src/tools/webhook/index.js`
- [ ] 2.22 Move `src/tools/yaml.js` → `src/tools/yaml/index.js`
- [ ] 2.23 Move `src/tools/api.js` → `src/tools/api/index.js`

## 3. Create re-export index.js for multi-file tool groups

- [ ] 3.1 Create `src/tools/fileExtract/index.js` that re-exports `docxTool`, `pdfTool`, `pptxTool`, `xlsxTool` from their sibling files
- [ ] 3.2 Create `src/tools/spreadsheet/index.js` that re-exports `spreadsheet` from its sibling file
- [ ] 3.3 Rename `src/tools/fileCreate/pptx.js` → `src/tools/fileCreate/index.js`

## 4. Update central registry imports in src/tools/index.js

- [ ] 4.1 Update all flat imports to directory imports (e.g., `"./clarify.js"` → `"./clarify/index.js"`)
- [ ] 4.2 Update `fileExtract` imports to use `./fileExtract/index.js` pattern
- [ ] 4.3 Update `fileCreate` import to use `./fileCreate/index.js`
- [ ] 4.4 Verify all existing directory imports (`calendar/`, `email/`, `namecom/`) remain unchanged
- [ ] 4.5 Verify `common.js` import path remains `"./common.js"`

## 5. Verify no other files import from old paths

- [ ] 5.1 Search the codebase for any imports referencing old flat tool paths
- [ ] 5.2 Update any discovered imports to use new directory paths
- [ ] 5.3 Verify `common.js` is not imported from any relocated file (it stays flat)

## 6. Run verification

- [ ] 6.1 Run `node --check` on all moved files to verify syntax
- [ ] 6.2 Run `npm run lint` to verify no lint errors
- [ ] 6.3 Run `npm run test` to verify all tests pass
- [ ] 6.4 Run `npm start` with timeout to verify app starts
