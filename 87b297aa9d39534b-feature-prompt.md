CHANGE_NAME: add-presentation-creation-tool

## Summary

Add a presentation creation tool that generates .pptx files from structured content. The existing `src/tools/fileExtract/pptx.js` is read-only — it extracts content from existing presentations. This tool fills the creation gap by accepting structured slide data and producing valid .pptx files using the pptxgenjs library.

## Technical Approach

Create `src/tools/fileCreate/pptx.js` following the established tool pattern in the codebase. The tool will use pptxgenjs (v3.x+) as its sole dependency — a pure JavaScript library with no system-level dependencies, making it cross-platform and reliable in containerized environments.

The zod schema will accept a structured object containing:
- `output`: file path for the generated .pptx
- `slides`: array of slide objects, each with `layout`, `title`, `content`, optional `images`, optional `charts`
- Optional `template`: path to an existing .pptx to clone as a base

Each slide layout (title, content, two-column, comparison, quote, image-only) will be handled via pptxgenjs's built-in layout system. Image embedding will pass through MIME whitelist validation before being added to slides. Charts will support basic bar, line, and pie types with simple data arrays.

The implementation mirrors the existing fileExtract tool structure but inverts the operation — instead of reading and parsing PPTX content, it constructs and writes it. File output paths will be validated against the allowed write directory per AGENTS.md security rules.

## Architectural Decisions

- **Separate file from fileExtract**: Rather than extending the existing read-only pptx.js, create a new fileCreate/pptx.js. This keeps read and write concerns separate and follows the existing fileExtract/fileCreate pattern.
- **pptxgenjs over alternatives**: Chosen for its pure JS nature (no LibreOffice/python-pptx dependencies), active maintenance (2M+ weekly downloads), and comprehensive feature set including layouts, images, charts, and templates.
- **Basic charts first**: Start with bar, line, and pie charts. Complex chart types (scatter, radar, area) are deferred to follow-up PRs based on user demand.
- **Template support**: Allow cloning an existing PPTX as a base. This enables users to apply corporate branding or pre-designed layouts without starting from scratch.