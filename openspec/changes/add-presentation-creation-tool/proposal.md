## Why

The existing PPTX tool (`src/tools/fileExtract/pptx.js`) is read-only — it extracts content from existing presentations. Users need to create presentations (pitch decks, status reports, training materials) from structured content without falling back to shell commands or manual creation. This fills a gap in the tool ecosystem.

## What Changes

- Add new tool `src/tools/fileCreate/pptx.js` that generates .pptx files from structured content using pptxgenjs
- Support multiple slide layouts: title, content, two-column, comparison, quote, image-only
- Support font styling, colors, alignment, spacing
- Support image embedding with MIME validation
- Support basic charts (bar, line, pie)
- Support template cloning from existing PPTX files
- Add pptxgenjs as a dependency
- Register the tool in `src/tools/index.js` with `filesystem:write` permission
- Add unit tests for slide creation, layout handling, image embedding, and chart generation

## Capabilities

### New Capabilities
- `pptx-creation`: Generate .pptx presentation files from structured content with slide layouts, formatting, images, and charts

### Modified Capabilities
- `pptx-extraction`: No spec-level requirement changes — the existing read tool remains unchanged. The new creation tool is complementary.

## Impact

- **New files**: `src/tools/fileCreate/pptx.js`, `tests/unit/tools/fileCreate_pptx.test.js`
- **Modified files**: `src/tools/index.js` (tool registration), `package.json` (pptxgenjs dependency)
- **New dependency**: `pptxgenjs` (v3.x+)
- **Security**: File output path validation, image MIME whitelist validation, template PPTX structure validation
- **Permissions**: `filesystem:write` scope required

## Non-goals

- Advanced chart types (scatter, radar, area) — deferred to follow-up
- Custom font file upload — deferred to follow-up
- Web-based presentation service
- PPTX-to-other-format conversion
- Real-time collaboration features