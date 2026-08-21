## 1. Setup Dependencies

- [ ] 1.1 Add npm dependencies: docx, exceljs, pptxgenjs, pdfkit, and their type definitions
- [ ] 1.2 Run npm install and verify no dependency conflicts

## 2. Create DOCX Write Tool

- [ ] 2.1 Create src/tools/fileExtract/createDocx.js with markdown-to-DOCX conversion
- [ ] 2.2 Create src/tools/fileExtract/createDocx.js with structured JSON-to-DOCX conversion
- [ ] 2.3 Add zod input schema for createDocx tool
- [ ] 2.4 Write unit tests for createDocx (tests/unit/tools/fileExtract/createDocx.test.js)

## 3. Create XLSX Write Tool

- [ ] 3.1 Create src/tools/fileExtract/createXlsx.js with tabular data-to-XLSX conversion
- [ ] 3.2 Add formula support (SUM, AVERAGE, cell references)
- [ ] 3.3 Add multi-sheet support
- [ ] 3.4 Add zod input schema for createXlsx tool
- [ ] 3.5 Write unit tests for createXlsx (tests/unit/tools/fileExtract/createXlsx.test.js)

## 4. Create PPTX Write Tool

- [ ] 4.1 Create src/tools/fileExtract/createPptx.js with slide definition-to-PPTX conversion
- [ ] 4.2 Support title, bullet, and content slide layouts
- [ ] 4.3 Add image embedding support
- [ ] 4.4 Add zod input schema for createPptx tool
- [ ] 4.5 Write unit tests for createPptx (tests/unit/tools/fileExtract/createPptx.test.js)

## 5. Create PDF Write Tool

- [ ] 5.1 Create src/tools/fileExtract/createPdf.js with markdown-to-PDF conversion using pdfkit
- [ ] 5.2 Add HTML-to-PDF support
- [ ] 5.3 Add metadata support (title, author, subject)
- [ ] 5.4 Add zod input schema for createPdf tool
- [ ] 5.5 Write unit tests for createPdf (tests/unit/tools/fileExtract/createPdf.test.js)

## 6. Tool Registration

- [ ] 6.1 Register all four tools in src/tools/index.js with TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS
- [ ] 6.2 Set permission tier to filesystem:write for all write tools
- [ ] 6.3 Verify tool discovery works (tools appear in registry)

## 7. Integration & Verification

- [ ] 7.1 Run npm run test and verify all tests pass
- [ ] 7.2 Run npm run lint and fix any lint errors
- [ ] 7.3 Run npm run coverage and verify coverage is maintained
- [ ] 7.4 Run timeout 10 npm start to verify application starts without crashing