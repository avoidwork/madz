## Why

The agent can read PDFs but has no way to produce or modify them. This blocks any workflow that requires generating reports, contracts, or documents as PDF output, or manipulating existing PDFs (merging, splitting, watermarking). Without PDF writing, the agent's document capabilities are fundamentally one-sided.

## What Changes

- Add a new `pdf` tool under `src/tools/pdf.js` with functions for:
  - Generating PDFs from HTML/markdown input
  - Merging multiple PDF files into one
  - Splitting PDFs by page range or individual pages
  - Adding text or image watermarks
  - Embedding signatures (image or text)
  - Adding annotations (highlights, notes)
- Accept file paths or base64-encoded content as input for all operations
- Return file paths or base64-encoded output
- Add `pdf-lib` and `puppeteer` as dependencies
- Register the `pdf` tool in `src/tools/index.js` with appropriate permissions

## Capabilities

### New Capabilities
- `pdf-generation`: Generate PDFs from HTML or markdown content using puppeteer
- `pdf-manipulation`: Merge, split, watermark, sign, and annotate PDFs using pdf-lib

### Modified Capabilities
<!-- None — no existing spec requirements are changing -->

## Impact

- **New dependencies:** `pdf-lib` (PDF manipulation), `puppeteer` (HTML-to-PDF)
- **New file:** `src/tools/pdf.js` — the PDF tool implementation
- **Modified file:** `src/tools/index.js` — register the new pdf tool
- **Modified file:** `package.json` — add dependencies
- **Sandbox permissions:** `filesystem:read`, `filesystem:write`, `process:spawn` (for puppeteer's Chromium)
- **Tests:** `tests/unit/tools_pdf.test.js` — unit tests for all PDF operations

## Non-goals

- PDF reading (already exists)
- Server-side PDF generation via external API
- Shell-based tools like wkhtmltopdf
- PDF form filling or OCR
- PDF encryption/decryption beyond watermarking