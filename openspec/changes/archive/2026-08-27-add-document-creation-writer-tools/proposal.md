## Why

The agent can read DOCX, XLSX, PPTX, and PDF files but has no way to create or write them. In office workflows, drafting a report, building a spreadsheet, creating a slide deck, or generating a PDF summary are critical gaps. Currently the agent must fall back to shell commands invoking pandoc, python-docx, or similar — which is fragile and requires the user to have those tools installed. A native Node.js-based write capability provides a reliable, consistent interface.

## What Changes

- Add four new write tools: `createDocx`, `createXlsx`, `createPptx`, `createPdf`
- Each tool accepts structured content and outputs the requested file format
- New npm dependencies: `docx`, `exceljs`, `pptxgenjs`, `pdfkit`
- New spec files for each write capability
- Tool registration in `src/tools/index.js` with appropriate permissions
- Unit and integration tests for each tool

## Capabilities

### New Capabilities

- `docx-creation`: Create DOCX files from structured content (headings, paragraphs, tables)
- `xlsx-creation`: Create XLSX files with sheets, cells, formulas, and formatting
- `pptx-creation`: Create PPTX files with slides, text, and images
- `pdf-creation`: Generate PDF files from markdown or HTML content

### Modified Capabilities

- `docx-extraction`: Extended to include write counterpart (new capability, not modification)
- `xlsx-extraction`: Extended to include write counterpart (new capability, not modification)
- `pptx-extraction`: Extended to include write counterpart (new capability, not modification)
- `pdf-extraction`: Extended to include write counterpart (new capability, not modification)

## Impact

- **Affected code**: `src/tools/fileExtract/createDocx.js`, `createXlsx.js`, `createPptx.js`, `createPdf.js`, `src/tools/index.js`, `src/tools/fileExtract/formatValidator.js`
- **Dependencies**: New npm packages — `docx`, `exceljs`, `pptxgenjs`, `pdfkit`
- **Tests**: New test files in `tests/unit/tools/fileExtract/`
- **Non-goals**: Rich HTML-to-PDF rendering (puppeteer), chart generation in XLSX/PPTX, template-based document generation