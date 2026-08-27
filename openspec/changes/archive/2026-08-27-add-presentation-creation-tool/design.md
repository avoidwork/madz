## Context

The madz project has a PPTX extraction tool (`src/tools/fileExtract/pptx.js`) that reads existing presentations. Users need the ability to create presentations from structured content — pitch decks, status reports, training materials — without shell commands or manual creation. The tool ecosystem supports extraction (PDF, DOCX, XLSX, PPTX) but lacks creation capabilities.

## Goals / Non-Goals

**Goals:**
- Create a new tool `src/tools/fileCreate/pptx.js` that generates .pptx files from structured content
- Support common slide layouts: title, content, two-column, comparison, quote, image-only
- Support font styling, colors, alignment, spacing
- Support image embedding with MIME validation
- Support basic charts (bar, line, pie)
- Support template cloning from existing PPTX files
- Register the tool with `filesystem:write` permission
- Add comprehensive unit tests

**Non-Goals:**
- Advanced chart types (scatter, radar, area)
- Custom font file upload
- Web-based presentation service
- PPTX-to-other-format conversion
- Real-time collaboration

## Decisions

### Decision 1: Use pptxgenjs (v3.x+)
**Rationale:** Pure JavaScript, no system dependencies, cross-platform, supports layouts/images/charts/fonts/templates. 2M+ weekly npm downloads, actively maintained. Superior to alternatives like `node-pptx` which is less maintained and lacks chart support.

### Decision 2: Separate fileCreate directory from fileExtract
**Rationale:** Mirrors the existing project structure where `src/tools/fileExtract/` handles read operations and `src/tools/fileCreate/` handles write operations. Clear separation of concerns, consistent with the codebase pattern.

### Decision 3: Zod v4 input schema with structured content object
**Rationale:** The tool accepts a single structured object: `{ title, slides: [{ layout, title, content, images, charts }] }`. Zod v4 provides runtime validation matching the existing tool pattern. Each slide object validates layout type, content structure, and optional media.

### Decision 4: Default fonts (Arial, Calibri, Helvetica) with no custom font upload
**Rationale:** pptxgenjs ships with built-in fonts that work cross-platform. Custom font upload adds complexity (file upload, MIME validation, font embedding) that is deferred to a follow-up PR.

### Decision 5: Image MIME whitelist validation before embedding
**Rationale:** Security requirement per AGENTS.md §1.2. Images must pass whitelist + MIME validation to prevent executable payloads disguised as images. Supported formats: PNG, JPEG, GIF, BMP, SVG.

## Risks / Trade-offs

[Risk] pptxgenjs v3.x API changes in future releases → [Mitigation] Pin version in package.json, add integration test with checksum validation
[Risk] Large presentations (100+ slides) may cause memory issues → [Mitigation] Stream processing not needed for typical use cases; add note in JSDoc about practical limits
[Risk] Chart rendering differences across PPTX viewers → [Mitigation] Use pptxgenjs defaults, test with multiple viewers

## Migration Plan

No migration needed. This is a new tool addition. The existing pptx-extraction tool remains unchanged.

## Open Questions

- Should the tool accept a `templatePath` parameter to clone an existing PPTX? (Yes — included in scope)
- Should chart data accept CSV strings or structured arrays? (Structured arrays for type safety)