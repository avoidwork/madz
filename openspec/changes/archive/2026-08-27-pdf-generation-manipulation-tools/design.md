## Context

The madz agent currently has PDF reading capability via an existing tool (likely `src/tools/pdf.js` or similar). However, there is no way to generate or modify PDFs. This creates a one-sided document workflow where the agent can consume PDFs but cannot produce them. Users need PDF generation for reports, contracts, formatted documents, and PDF manipulation for merging, splitting, watermarking, and annotation.

The project uses Node.js 24+ with ESM, follows strict linting (oxlint/oxfmt), and uses a tool registration pattern in `src/tools/index.js`. Tools are async functions with zod input schemas and permission-based sandbox execution.

## Goals / Non-Goals

**Goals:**
- Generate PDFs from HTML or markdown content
- Merge multiple PDF files into a single document
- Split PDFs by page range or individual pages
- Add text or image watermarks to PDFs
- Embed signatures (image or text) into PDFs
- Add annotations (highlights, notes) to PDF pages
- Support both file paths and base64-encoded content as input/output

**Non-Goals:**
- PDF reading (already exists)
- Server-side PDF generation via external API
- Shell-based tools like wkhtmltopdf
- PDF form filling or OCR
- PDF encryption/decryption beyond watermarking
- PDF/A or PDF/X compliance

## Decisions

### Decision 1: Use pdf-lib for manipulation
**Rationale:** pdf-lib is actively maintained, supports PDF 1.5+ features, has a fluent API, and works entirely in JavaScript with no native dependencies. Alternatives like `node-pdf` are unmaintained, and `pdfkit` only creates PDFs from scratch (no manipulation). pdf-lib excels at modification operations (merge, split, watermark, annotate).

### Decision 2: Use puppeteer for HTML-to-PDF
**Rationale:** puppeteer provides headless Chrome/Chromium rendering, which produces high-quality PDFs that match browser rendering. It supports headers, footers, margins, paper sizes, and CSS styling. Alternatives like `playwright` are similar but puppeteer has broader ecosystem adoption and better documentation for PDF generation. `puppeteer-core` could be used to avoid browser download, but bundling Chromium ensures consistent output across environments.

### Decision 3: Single tool file (`src/tools/pdf.js`)
**Rationale:** All PDF operations belong to a single capability domain. Keeping them in one file follows the existing pattern (e.g., `src/tools/web.js` for web operations). The tool exposes multiple functions rather than being split into separate tools, keeping the tool namespace clean and reducing registration complexity.

### Decision 4: Base64 support for all operations
**Rationale:** The sandbox environment may restrict file system access in some configurations. Base64 input/output allows the tool to work in both file-based and memory-based modes. File paths are preferred when available, but base64 serves as a fallback.

### Decision 5: Zod v4 input schemas
**Rationale:** The project uses Zod v4 for validation. All tool inputs must be validated against zod schemas before processing. Error messages should be clear and actionable.

## Risks / Trade-offs

### Risk: Large PDF files cause memory issues
**Mitigation:** Use streaming where possible (puppeteer's `page.pdf()` supports streams). For pdf-lib operations, add a configurable max file size limit (default 50MB) and reject larger files with a clear error.

### Risk: Puppeteer requires Chromium installation
**Mitigation:** puppeteer bundles Chromium by default. In environments where the bundle fails (e.g., no internet), provide a `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` fallback that uses a system-installed Chromium. Document this in the tool's JSDoc.

### Risk: Base64 encoding of large PDFs is inefficient
**Mitigation:** Base64 is only used when file paths are unavailable. The tool prefers file paths when both options are provided. Document this preference in the tool's description.

### Risk: Watermark positioning varies by PDF viewer
**Mitigation:** Use pdf-lib's `drawText` with absolute positioning on a new page layer. Document that watermark appearance may vary slightly between viewers and recommend testing with Adobe Acrobat for production use.

### Trade-off: pdf-lib vs PDFKit for generation
**Decision:** pdf-lib for manipulation (merge, split, watermark, annotate) and puppeteer for generation (HTML/markdown to PDF). pdfKit could generate PDFs from scratch but puppeteer produces higher-quality output with proper CSS rendering. The two-library approach is intentional — each excels at its domain.

## Migration Plan

No migration needed. This is a new feature that adds capabilities without modifying existing behavior. The new `pdf` tool is registered alongside existing tools and does not affect any existing functionality.

## Open Questions

1. Should watermark opacity be configurable? (Default: 0.3, range: 0-1)
2. Should signature support include certificate-based digital signatures? (Out of scope for v1 — only image/text embedding)
3. Should the tool support PDF templates (pre-formatted PDFs with fillable regions)? (Deferred — could be added in a future iteration)