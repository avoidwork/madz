## Why

Users frequently work with proprietary or binary file formats (`.docx`, `.pptx`, `.xlsx`, PDF, etc.) that are opaque to LLMs and text-based tooling. Converting these formats into structured markdown or JSON enables content extraction, analysis, and integration into the agent workflow. Most common office formats are ZIP archives containing XML, making extraction feasible with shared parsing utilities.

## What Changes

- Add a shared `extract-zip-xml` utility for ZIP-based format decompression and XML parsing
- Implement format-specific extraction tools: `docx-to-markdown`, `pptx-to-markdown`, `xlsx-to-markdown`, `xlsx-to-json`, `pdf-to-markdown`
- Register all new tools in the central tool registry (`src/tools/index.js`) with appropriate permissions and classifications
- Add `pdf-parse` dependency for PDF text extraction
- Create comprehensive unit tests with sample file fixtures

## Capabilities

### New Capabilities
- `file-extraction`: Shared ZIP/XML extraction utility for decompressing and parsing ZIP-based document formats (docx, pptx, xlsx, odt, ods, odp, epub, pages, numbers, key)
- `docx-extraction`: Convert `.docx` files to structured markdown with headings, paragraphs, lists, tables, and inline formatting
- `pptx-extraction`: Convert `.pptx` files to markdown with slide titles, bullet points, and speaker notes
- `xlsx-extraction`: Convert `.xlsx` files to markdown tables or JSON with cell values, types, and references
- `pdf-extraction`: Extract text from PDF files to markdown; OCR path documented for future enhancement

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **Affected code**: `src/tools/index.js` (tool registration), `src/tools/vision.js` (pattern reference), `src/tools/shell.js` (sandbox constraints)
- **New dependencies**: `pdf-parse` for PDF extraction; `adm-zip` or `jszip` for ZIP handling (likely already available via existing dependencies)
- **New files**: `src/tools/fileExtract/` directory with utility and format-specific parsers
- **Test fixtures**: Sample docx, pptx, xlsx, and PDF files in `tests/fixtures/`
- **Non-goals**: Legacy binary formats (`.ppt`, `.xls`), OCR for scanned PDFs, embedded media extraction, charts/macros/pivot tables
