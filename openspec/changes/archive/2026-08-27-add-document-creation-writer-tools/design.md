## Context

The madz agent currently has read-only tools for DOCX, XLSX, PPTX, and PDF file formats. These tools extract content from existing files but cannot create new ones. Office workflows frequently require the agent to draft documents, build spreadsheets, create presentations, or generate PDF summaries. Currently the agent must fall back to shell commands invoking external tools (pandoc, python-docx, LibreOffice), which is fragile and requires the user to have those tools installed in their environment.

## Goals / Non-Goals

**Goals:**
- Add four write tools: createDocx, createXlsx, createPptx, createPdf
- Each tool accepts structured content and outputs the requested file format
- Pure Node.js implementations with no native dependencies or external tool requirements
- Consistent API pattern matching existing read tools
- Full test coverage with unit and integration tests

**Non-Goals:**
- Rich HTML-to-PDF rendering (puppeteer/Chromium)
- Chart generation in XLSX or PPTX
- Template-based document generation with pre-built templates
- File format conversion (e.g., DOCX to PDF)
- Password-protected or encrypted documents

## Decisions

### Decision 1: Pure Node.js Libraries Over Puppeteer

**Choice:** Use pdfkit for PDF generation instead of puppeteer.

**Rationale:** Puppeteer requires a full Chromium installation (~130MB), significantly increasing the Docker image size. pdfkit is lightweight (~50KB) and sufficient for the agent's use cases: text-heavy documents, reports, and summaries. If rich HTML rendering becomes a requirement later, puppeteer can be added as an optional dependency.

**Alternatives considered:**
- puppeteer: Full browser rendering, but heavy dependency footprint
- playwright: Similar to puppeteer, also heavy

### Decision 2: exceljs Over SheetJS (xlsx)

**Choice:** Use exceljs for XLSX generation.

**Rationale:** exceljs supports formulas, cell formatting, and styling in the free version. SheetJS's formula support is limited in the free tier. The agent frequently needs to create spreadsheets with calculated columns, making formula support essential.

**Alternatives considered:**
- SheetJS (xlsx): Lighter bundle, but formula support limited in free version
- xlsx-populate: Good API but less actively maintained

### Decision 3: Unified Tool Interface

**Choice:** All four tools accept `{ content, options }` as input and return `{ filePath, format, size }` on success.

**Rationale:** Consistent API reduces cognitive load for the agent. Each tool's `content` field adapts to its format:
- DOCX: markdown string or structured JSON with headings/paragraphs/tables
- XLSX: JSON array of arrays (tabular data) with optional sheet metadata
- PPTX: JSON array of slide objects with layout type, title, content
- PDF: markdown or HTML string with optional metadata

**Alternatives considered:**
- Separate input schemas per tool: More flexible but inconsistent
- Unified JSON schema: Overly complex for simple use cases

### Decision 4: Temp File Output Pattern

**Choice:** Files are written to a temp directory and the path is returned. The caller (agent) is responsible for moving or using the file.

**Rationale:** Matches the existing read tool pattern where files are read from disk. The agent can then use the shell tool to move, copy, or upload the file as needed. This keeps the write tools stateless and avoids cleanup complexity.

**Alternatives considered:**
- Return file content as base64: Works for small files but impractical for large documents
- Auto-cleanup after N minutes: Adds complexity and potential data loss

### Decision 5: Tool Registration Pattern

**Choice:** Register tools in `src/tools/index.js` following the existing factory pattern with permission tiers.

**Rationale:** Maintains consistency with the existing codebase. Write tools are classified as `filesystem:write` permission tier, higher than the read tools' `filesystem:read` tier.

## Risks / Trade-offs

### Risk: Bundle Size Increase

**Impact:** Four new npm packages add ~2-3MB to the node_modules directory.

**Mitigation:** Use npm's tree-shaking and verify the final Docker image size. All four libraries are pure JavaScript with minimal native dependencies.

### Risk: Library Compatibility

**Impact:** New dependencies may have peer dependency conflicts or Node.js version requirements.

**Mitigation:** Test with Node.js 24+ before merging. Pin exact versions in package.json.

### Risk: File Size Limits

**Impact:** Large documents (100+ page PDFs, 10k+ row spreadsheets) may cause memory pressure.

**Mitigation:** Add configurable size limits via tool options. Stream output where possible (pdfkit supports streaming).

### Risk: Format Fidelity

**Impact:** Generated files may not perfectly match hand-crafted documents (font rendering, page layout).

**Mitigation:** Document known limitations in tool descriptions. Accept that agent-generated documents are functional, not production-perfect.

## Migration Plan

1. Add npm dependencies
2. Create tool modules with full implementation
3. Add tests and verify coverage
4. Register tools in index.js
5. Update tool permissions in config
6. Test end-to-end with the agent
7. No rollback needed — tools are additive, not destructive

## Open Questions

- Should write tools accept a `filename` option, or auto-generate names with timestamps?
- Should there be a unified `createDocument` tool that auto-detects format from extension?
- Should write tools support streaming output for very large files?