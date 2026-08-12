## Context

Madz currently supports vision-based file processing (`src/tools/vision.js`) and web content extraction (`src/tools/web.js`), but has no tools for extracting content from common office and personal file formats. Users working with `.docx`, `.pptx`, `.xlsx`, PDF, and similar formats cannot query their content through the agent.

Most office formats share a common architecture: ZIP archives containing XML files. This presents an opportunity for a shared extraction layer. PDF is architecturally distinct and requires a separate code path.

## Goals / Non-Goals

**Goals:**
- Provide a shared ZIP/XML extraction utility for archive-based formats
- Implement format-specific extraction tools for docx, pptx, xlsx, and PDF
- Output structured markdown (or JSON for tabular data) suitable for LLM consumption
- Register all tools in the central registry with appropriate permissions
- Include comprehensive unit tests with sample file fixtures

**Non-Goals:**
- Legacy binary formats (`.ppt`, `.xls`, `.doc`) — require OLE compound file parsing
- OCR for scanned PDFs — documented as future enhancement
- Embedded media extraction (images, audio, video within documents)
- Charts, macros, pivot tables, or complex spreadsheet formulas
- Writing/creating documents — extraction only

## Decisions

### Decision 1: Shared ZIP/XML Utility
**Choice**: Create `extractZipXml(filePath)` returning `Map<string, string>` (filename → XML content).
**Rationale**: Eliminates code duplication across 5+ format parsers. Centralizes error handling for corrupted archives. Each format-specific parser receives the same consistent input.
**Alternatives considered**:
- Inline ZIP handling in each tool → rejected (code duplication, inconsistent error handling)
- External library abstraction → rejected (unnecessary indirection for a single function)

### Decision 2: PDF as Separate Code Path
**Choice**: Use `pdf-parse` directly; do not force PDF into ZIP/XML pattern.
**Rationale**: PDF is a fundamentally different format with its own binary structure. The ZIP/XML pattern does not apply. `pdf-parse` is lightweight, well-maintained, and sufficient for text extraction.
**Alternatives considered**:
- `pdfjs-dist` (Mozilla) → rejected (larger bundle, more complex API)
- Custom PDF parser → rejected (unnecessary complexity)

### Decision 3: Markdown as Primary Output
**Choice**: All tools output markdown; xlsx additionally supports JSON output.
**Rationale**: Markdown is the natural input format for LLMs. The project already depends on `marked`. JSON output for xlsx enables programmatic consumption of tabular data.
**Alternatives considered**:
- Plain text → rejected (loses structure: headings, lists, tables)
- HTML → rejected (not LLM-friendly, requires stripping)

### Decision 4: Tool Registration Pattern
**Choice**: Follow the existing pattern from `src/tools/vision.js` — async function with zod input schema, registered in `src/tools/index.js` with permission tier and classification.
**Rationale**: Consistency with existing codebase. Minimal learning curve for future contributors.

### Decision 5: Sandbox Permissions
**Choice**: All tools require `filesystem:read` permission. File paths are validated against the sandbox path resolver.
**Rationale**: Tools read files from the filesystem. No write operations needed. Sandbox constraints from `src/tools/shell.js` apply.

## Risks / Trade-offs

[Risk] ZIP archives may be corrupted or password-protected → Mitigation: Graceful error handling with descriptive messages. Tools return structured error output, not crashes.

[Risk] Large documents may cause memory issues → Mitigation: Stream processing where possible. Document size limits in tool descriptions.

[Risk] XML namespaces vary across formats → Mitigation: Each format parser handles its own namespace resolution. Shared utility provides namespace-agnostic filename lookup.

[Risk] PDF text extraction may produce garbled output for complex layouts → Mitigation: Document limitations in tool description. OCR path documented for future enhancement.

[Risk] New dependencies increase attack surface → Mitigation: Only `pdf-parse` added (minimal, well-audited). ZIP handling uses existing Node.js `zlib` or `archiver` dependencies.

## Migration Plan

No migration required. This is a greenfield feature addition. Existing tools and workflows are unaffected.

## Open Questions

1. Should xlsx output include cell formatting (bold, color, formulas) or just values? → Default to values only; formatting can be added later.
2. Should pptx extraction include slide notes by default? → Yes, included in markdown output.
3. Should we support `.odt`/`.ods`/`.odp` (OpenDocument) in v1? → Yes, they follow the same ZIP/XML pattern as Office formats.
