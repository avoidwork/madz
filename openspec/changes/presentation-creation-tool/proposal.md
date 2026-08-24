## Why

The existing PPTX tool (`src/tools/fileExtract/pptx.js`) is read-only — it extracts content from existing presentations. Marketing teams need to create slide decks: pitch decks, status reports, training materials, and client presentations. Currently the agent can only read PPTX files, not create them. Users must fall back to shell commands (python-pptx, libreoffice) or manual creation, which is fragile and loses formatting fidelity.

## What Changes

- Add a new tool `src/tools/fileCreate/pptx.js` that creates PowerPoint presentations using `pptxgenjs`
- Accept structured content: slides with layouts, text, formatting, images, and tables
- Support slide layouts: title, content, two-column, comparison, quote, image-only
- Support text formatting: font family, size, color, bold, italic, alignment
- Support image embedding from file paths with MIME validation
- Support table rendering on slides
- Support template loading from existing .pptx files
- Register tool in `src/tools/index.js` with `filesystem:write` capability
- Add `pptxgenjs` as a new npm dependency
- Create new OpenSpec spec for pptx-creation capability

## Capabilities

### New Capabilities
- `pptx-creation`: PowerPoint presentation creation with slides, layouts, formatting, images, tables, and template support

### Modified Capabilities
- None

## Impact

- **New dependency**: `pptxgenjs` (v3.x+)
- **New file**: `src/tools/fileCreate/pptx.js`
- **Modified file**: `src/tools/index.js` (tool registration)
- **Modified file**: `package.json` (dependency)
- **New spec**: `openspec/specs/pptx-creation/spec.md`
- **New tests**: `tests/unit/tools/pptx.test.js`
- **Non-goals**: Chart generation, custom font file upload, slide transitions/animations
