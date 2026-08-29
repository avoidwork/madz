## Context

The `src/tools/` directory is the central tool registry for the madz AI harness. It currently contains 23 flat `.js` files and 6 subdirectory-organized tool groups (`calendar/`, `email/`, `fileExtract/`, `spreadsheet/`, `namecom/`, `fileCreate/`). The central `src/tools/index.js` imports from both flat files and subdirectories, creating an inconsistent pattern that makes navigation, onboarding, and maintenance difficult.

The tools subsystem uses a factory pattern where each tool is an async function with a Zod input schema. Tools are registered in `index.js` with permission scopes (`TOOL_PERMISSIONS`) and agent type classifications (`TOOL_CLASSIFICATIONS`). The `common.js` file provides shared utilities used by many tools.

## Goals / Non-Goals

**Goals:**
- Establish a uniform subdirectory-based organizational pattern for all tool modules
- Every tool lives in its own feature directory with an `index.js` entry point
- Helper files (parsers, validators, providers) remain as siblings within their feature directory
- Update the central registry import paths to reflect the new structure
- Maintain zero functional change — all exports, permissions, and classifications remain identical

**Non-Goals:**
- Changing tool logic, functionality, or exported APIs
- Adding new tools or features
- Refactoring `common.js` or moving it into a directory
- Changing the permission or classification system
- Reorganizing other directories (`src/agent/`, `src/memory/`, etc.)
- Adding tests for the restructured code (tests mirror `src/` structure and may need path updates)

## Decisions

### Decision 1: Subdirectory pattern over flat files
**Choice:** Every tool gets its own directory with `index.js` as the entry point.
**Rationale:** The subdirectory pattern already exists in 6 of 8 groups and scales better. It groups related files (providers, parsers, validators) and matches Node.js module resolution conventions. Flat files work for single-file modules but become unwieldy as tools grow.
**Alternatives considered:**
- All flat: Would require creating a new convention for helper files, which already exist in subdirectories.
- Hybrid (flat for simple, directory for complex): Would perpetuate the inconsistency we're trying to eliminate.

### Decision 2: `common.js` stays flat
**Choice:** `common.js` remains at `src/tools/common.js` rather than being moved to `src/tools/common/index.js`.
**Rationale:** `common.js` is a shared utility used by many tools across the codebase. Moving it would create circular import risks (tools import common, common imports tools) and offers no organizational benefit since it's not a feature with sub-modules.
**Alternatives considered:**
- Move to `common/index.js`: Would require updating all import paths and risks circular dependencies.
- Move to `src/common.js`: Would separate it from the tools context, making it harder to discover.

### Decision 3: Re-export pattern for multi-file directories
**Choice:** Directories with multiple source files (e.g., `fileExtract/`, `spreadsheet/`) get an `index.js` that re-exports the main tool function, while helper files remain accessible as named imports.
**Rationale:** This maintains backward compatibility — code that imports `src/tools/fileExtract/pdf.js` directly still works, while new code can import the main tool via `src/tools/fileExtract/index.js`.
**Alternatives considered:**
- Remove direct helper access: Would break existing imports but simplify the structure. Not worth the breaking change for a refactor.

### Decision 4: Preserve existing export names
**Choice:** Each `index.js` re-exports the original function with its original name (e.g., `export { clarify } from "./clarify.js"`).
**Rationale:** The central `index.js` imports by name (e.g., `import { clarify } from "./clarify/index.js"`). Changing export names would require updating `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, and all downstream consumers.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Circular imports between helper files and index.js | Keep helper files as named exports, not re-exports; avoid importing index.js from helpers |
| Test files importing from old paths | Update test import paths to match new directory structure |
| External skills importing from `src/tools/` subpaths | Skills that import tool files directly will break; update skill import paths |
| `common.js` import path changes | `common.js` stays flat; no import path changes needed for it |
| Large diff makes review difficult | The diff is mechanical (file moves + import updates); review focuses on import correctness |

## Migration Plan

1. Create new directories for all flat tool files
2. Move each flat file into its directory as `index.js`
3. Create `index.js` re-export files for multi-file directories (`fileExtract/`, `spreadsheet/`, `fileCreate/`)
4. Rename `fileCreate/pptx.js` → `fileCreate/index.js`
5. Update all import paths in `src/tools/index.js`
6. Update any test files that import from old paths
7. Run tests to verify no import errors

## Open Questions

- Should `common.js` eventually be refactored into a proper module? (Out of scope — noted for future work)
- Are there any external tools or skills that import directly from `src/tools/` subpaths? (Needs verification during migration)
