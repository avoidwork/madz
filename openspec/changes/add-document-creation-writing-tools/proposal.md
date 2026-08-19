## Why

The agent can read DOCX, XLSX, PPTX, and PDF files but has no way to create or write them. This creates a critical gap in office workflows — drafting reports, building spreadsheets, creating slide decks, or generating PDF summaries all require shell invocations of external tools (pandoc, python-docx, etc.), which is fragile and requires user-installed dependencies. A native write capability provides a reliable, consistent interface.

## What Changes

- Add `createDocx` tool: generates DOCX files from markdown input using the `docx` npm package
- Add `createXlsx` tool: generates XLSX files from tabular data using `exceljs`
- Add `createPptx` tool: generates PPTX files from slide outline JSON using `pptxgenjs`
- Add `createPdf` tool: generates PDF files from markdown input using `@react-pdf/renderer`
- Each tool validates input via shared `formatValidator.js`, writes to sandboxed temp dir, returns `{ filePath, format }`
- Register all tools in `src/tools/index.js` with `TOOL_PERMISSIONS` and `TOOL_CLASSIFICATIONS` entries
- Add unit tests for each tool in `tests/unit/tools/fileExtract/`
- Add new npm dependencies: `docx`, `exceljs`, `pptxgenjs`, `@react-pdf/renderer`

## Capabilities

### New Capabilities
- `document-write`: Core API for creating DOCX, XLSX, PPTX, and PDF documents from structured input
- `document-validation`: Shared input validation for document creation tools

### Modified Capabilities
N/A

## Impact

- `src/tools/fileExtract/` — new tool files: createDocx.js, createXlsx.js, createPptx.js, createPdf.js
- `src/tools/index.js` — register new tools in TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS maps
- `src/tools/fileExtract/formatValidator.js` — may extend for document-specific validation
- `package.json` — new dependencies: docx, exceljs, pptxgenjs, @react-pdf/renderer
- `tests/unit/tools/fileExtract/` — new test files for each tool
- `prompts/` — may need updates to inform agents about new write capabilities