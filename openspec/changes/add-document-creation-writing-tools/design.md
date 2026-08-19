## Context

The madz agent currently has read-only tools for DOCX, XLSX, PPTX, and PDF files in `src/tools/fileExtract/`. There is no corresponding write capability. This creates a gap where the agent can parse documents but cannot create them natively, forcing reliance on shell invocations of external tools.

## Goals / Non-Goals

**Goals:**
- Implement four document creation tools: createDocx, createXlsx, createPptx, createPdf
- Each tool accepts structured input and returns a file path
- Shared validation via formatValidator.js
- Register tools in index.js with proper permissions and classifications
- Unit tests for each tool

**Non-Goals:**
- Modifying existing read tools
- Adding template support or styling beyond basic formatting
- Real-time collaboration or cloud storage integration
- Converting between formats (e.g., DOCX → PDF)

## Decisions

### Decision 1: Use npm packages over Python subprocesses
- **Choice:** Use native Node.js libraries (docx, exceljs, pptxgenjs, @react-pdf/renderer) rather than spawning Python processes
- **Rationale:** Simpler dependency management, no Python runtime required in the sandbox, consistent with the Node.js-first architecture
- **Alternatives considered:** python-docx via child_process.spawn — adds Python as a hard dependency, increases sandbox complexity

### Decision 2: Shared validation module
- **Choice:** Extend `src/tools/fileExtract/formatValidator.js` with document-specific validation functions
- **Rationale:** DRY principle — filename validation, content presence checks, and size limits are common across all four tools
- **Alternatives considered:** Separate validator per tool — introduces duplication

### Decision 3: Output to sandboxed temp directory
- **Choice:** Write generated files to a sandboxed temp directory (same pattern as existing read tools)
- **Rationale:** Security — prevents path traversal attacks, keeps generated files isolated
- **Alternatives considered:** Allow user-specified output paths — too permissive for a tool context

### Decision 4: Tool registration pattern
- **Choice:** Follow the existing pattern in `src/tools/index.js` — add entries to TOOL_PERMISSIONS and TOOL_CLASSIFICATIONS maps
- **Rationale:** Consistency with existing tools, no changes to the registration infrastructure needed

## Risks / Trade-offs

### Risk: @react-pdf/renderer bundle size
- **Impact:** Adds ~2MB to the dependency tree
- **Mitigation:** Acceptable for a Node.js project; the package is well-maintained and widely used

### Risk: DOCX formatting fidelity
- **Impact:** The `docx` library may not preserve all markdown formatting (e.g., complex tables, images)
- **Mitigation:** Document limitations in the tool's JSDoc; scope is basic formatting (headings, paragraphs, lists)

### Risk: XLSX formula support
- **Impact:** exceljs supports formulas but the initial implementation may not expose formula syntax
- **Mitigation:** Phase 2 enhancement — basic cell data is sufficient for the initial release

## Migration Plan

No migration needed — this is a pure addition. Existing tools and configurations remain unchanged.

## Open Questions

- Should the tools accept a `template` parameter for pre-styled documents? (Deferred to future enhancement)
- Should there be a unified `createDocument` tool with a `format` parameter instead of four separate tools? (Four separate tools align better with the existing read tool pattern)