# Feature Goals: Presentation Creation Tool

## Goal 1: Add presentation creation tool (pptxgenjs-based)

### Scope
- **Included:** Create a new tool `src/tools/fileCreate/pptx.js` that generates .pptx files from structured content using pptxgenjs
- **Included:** Support for multiple slide layouts (title, content, two-column, comparison, quote, image-only)
- **Included:** Font styling, colors, alignment, spacing
- **Included:** Image embedding with MIME validation
- **Included:** Basic chart support (bar, line, pie)
- **Included:** Template support (create from scratch or clone existing PPTX)
- **Excluded:** Advanced chart types (scatter, radar, etc.) — deferred to follow-up
- **Excluded:** Custom font file upload — deferred to follow-up
- **Excluded:** Web-based presentation service

### Key Requirements
1. Tool must follow existing tool pattern: zod schema, impl function, registration in index.js
2. Must use pptxgenjs (v3.x+) as the primary library — pure JavaScript, no system dependencies
3. Must validate file output path against allowed write directory (per AGENTS.md 1.2)
4. Must validate image MIME types before embedding
5. Must validate template files as valid PPTX (zip structure check)

### Acceptance Criteria
- Tool can create a .pptx file with at least one slide containing title and content
- Tool supports all specified layouts
- Tool can embed images with MIME validation
- Tool can generate basic charts (bar, line, pie)
- Tool can use an existing PPTX as a template
- Tests pass for all core functionality
- Lint and coverage checks pass

### Dependencies
- `pptxgenjs` npm package (v3.x+)
- Existing tool registration in `src/tools/index.js`
- Existing file validation utilities (if any)
- AGENTS.md security rules for file path and MIME validation

### Risks / Edge Cases
- Large presentations may cause memory issues — need to handle gracefully
- Image dimensions and formats must be validated
- Chart data with special characters or very long labels
- Template files that are corrupted or not valid PPTX
- Empty content edge cases (no slides, no content)