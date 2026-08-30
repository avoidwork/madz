## ADDED Requirements

### Requirement: All tools reside in feature directories
Every tool module in `src/tools/` MUST be located within its own feature directory. No tool file may exist as a flat `.js` file directly under `src/tools/`.

#### Scenario: Flat tool file is moved to directory
- **WHEN** a tool file such as `src/tools/clarify.js` exists at the flat path
- **THEN** it MUST be moved to `src/tools/clarify/index.js`

#### Scenario: Multi-file tool group has index entry point
- **WHEN** a tool group like `src/tools/fileExtract/` contains multiple files (`docx.js`, `pdf.js`, `xlsx.js`, parsers, validators)
- **THEN** it MUST have an `index.js` that re-exports the main tool functions, and all helper files remain as siblings

#### Scenario: Single-file tool group has index entry point
- **WHEN** a tool group like `src/tools/calendar/` contains `index.js`, `schemas.js`, and `providers/`
- **THEN** the `index.js` MUST serve as the primary entry point, with helpers accessible as named imports

### Requirement: Central registry imports use directory paths
The central `src/tools/index.js` MUST import all tools using their new directory-based paths.

#### Scenario: Flat import updated to directory import
- **WHEN** `src/tools/index.js` previously imported `from "./clarify.js"`
- **THEN** it MUST import `from "./clarify/index.js"`

#### Scenario: Directory import preserved for already-organized tools
- **WHEN** `src/tools/index.js` previously imported `from "./calendar/index.js"`
- **THEN** it MUST continue to import `from "./calendar/index.js"` (no change)

### Requirement: Export names remain unchanged
All tool functions MUST be exported with their original names from their new `index.js` locations.

#### Scenario: Export name preserved after move
- **WHEN** `clarify.js` exported `clarify` as a named export
- **THEN** `clarify/index.js` MUST export `clarify` as a named export

#### Scenario: Multi-export preserved
- **WHEN** `web.js` exported `webSearch` and `webExtract`
- **THEN** `web/index.js` MUST export both `webSearch` and `webExtract` as named exports

### Requirement: common.js remains flat
The shared utility file `common.js` MUST remain at `src/tools/common.js` and NOT be moved into a directory.

#### Scenario: common.js stays at root of tools
- **WHEN** `common.js` exists at `src/tools/common.js`
- **THEN** it MUST remain at `src/tools/common.js` with no path changes

### Requirement: No functional changes
The restructure MUST NOT change any tool behavior, exported APIs, permission scopes, or agent classifications.

#### Scenario: TOOL_PERMISSIONS unchanged
- **WHEN** the restructure is applied
- **THEN** every entry in `TOOL_PERMISSIONS` in `src/tools/index.js` MUST remain identical

#### Scenario: TOOL_CLASSIFICATIONS unchanged
- **WHEN** the restructure is applied
- **THEN** every entry in `TOOL_CLASSIFICATIONS` in `src/tools/index.js` MUST remain identical

#### Scenario: Tool function signatures unchanged
- **WHEN** a tool function is called with the same arguments
- **THEN** it MUST produce the same result as before the restructure
