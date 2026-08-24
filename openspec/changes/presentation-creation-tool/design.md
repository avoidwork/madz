## Context

The existing PPTX tool at `src/tools/fileExtract/pptx.js` uses `pptx-parser` to extract content from presentations. This tool is read-only. The agent harness needs a complementary write tool that creates presentations from structured content. The tool must follow the established pattern: zod schema, implementation function, registration in `src/tools/index.js`, and appropriate capability permissions.

## Goals / Non-Goals

**Goals:**
- Create a `createPptx` tool that generates .pptx files from structured input
- Support slide layouts: title, content, two-column, comparison, quote, image-only
- Support text formatting: font family, size, color, bold, italic, alignment
- Support image embedding from file paths with MIME validation
- Support table rendering on slides
- Support template loading from existing .pptx files
- Validate output paths against the allowed write directory
- Validate image files via extension whitelist and magic byte checks

**Non-Goals:**
- Chart generation (deferred to follow-up PR)
- Custom font file upload
- Slide transitions and animations
- Slide master customization beyond template support
- PPTX-to-PDF conversion
- Cloud storage integration

## Decisions

**Decision 1: Use pptxgenjs over alternatives**
- Rationale: Pure JavaScript, no native dependencies, 2M+ weekly downloads, actively maintained, supports all required features (layouts, images, tables, templates). `node-pptx` is less maintained and lacks chart support.
- Alternative: `python-pptx` via child process — rejected because it requires Python installation, adds system dependency, and breaks cross-platform consistency.

**Decision 2: Separate file from read tool**
- Rationale: The existing `src/tools/fileExtract/pptx.js` handles reading. The new tool goes in `src/tools/fileCreate/pptx.js` to maintain the read/write separation pattern used elsewhere (e.g., `fileExtract/docx.js` vs `fileCreate/docx.js`).
- This keeps each tool focused and testable.

**Decision 3: Zod v4 schema with explicit types**
- Rationale: The project uses Zod v4 for all tool input validation. The schema must be exported alongside the implementation for the tool registration system.
- The schema will use `z.object()` with nested arrays for slides, and optional fields for layout-specific content.

**Decision 4: Image validation via extension + magic bytes**
- Rationale: No external MIME detection library is needed. We validate by file extension (.png, .jpg, .jpeg, .gif, .bmp) and check magic bytes for the first three formats (PNG: 89 50 4E 47, JPEG: FF D8 FF, GIF: 47 49 46 38). This is consistent with the project's security rules for file uploads.

**Decision 5: Template loading via pptxgenjs API**
- Rationale: pptxgenjs has built-in template loading that preserves master slides and layouts. This is more reliable than manually reconstructing template structure. The template path is validated against the write directory before loading.

**Decision 6: Error hierarchy with PptxError**
- Rationale: The project requires domain-specific error classes extending `Error`. A `PptxError` class will extend the project's `AppError` class with a `code` property for structured error handling.

## Risks / Trade-offs

**Risk:** pptxgenjs v3.x API surface is large — some features may require trial and error.
→ Mitigation: Start with the most common layouts and text formatting. Add advanced features only if tests fail.

**Risk:** Image embedding requires file reads which could be slow for large images.
→ Mitigation: Limit image dimensions in validation. Use pptxgenjs's built-in compression.

**Risk:** Template loading from user-provided paths could be a security concern.
→ Mitigation: Validate template path against the write directory using the same path resolver used for output paths. Check that the file is a valid ZIP (PPTX structure).

**Risk:** pptxgenjs creates files synchronously internally.
→ Mitigation: Wrap the save operation in a timeout. The library is fast for typical presentations (< 50 slides).

## Migration Plan

No migration needed. This is a new tool that coexists with the existing read tool. No breaking changes to any existing APIs.

## Open Questions

- Should the tool accept base64-encoded images inline, or only file paths? Decision: file paths only for v1. Base64 can be added later if needed.
- Should the tool return the file path on success, or the file buffer? Decision: return the file path (consistent with other file-write tools in the codebase).
