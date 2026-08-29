## Why

The `src/tools/` directory has a mixed organizational pattern — 23 flat files coexist with 6 subdirectory-organized tool groups (`calendar/`, `email/`, `fileExtract/`, `spreadsheet/`, `namecom/`, `fileCreate/`). This inconsistency makes navigation, onboarding, and maintenance difficult. New tools have no clear convention for where to live, and the central `index.js` registry contains a mix of flat and nested imports. Adopting a uniform subdirectory pattern eliminates this ambiguity and scales cleanly as the toolset grows.

## What Changes

- Every tool module is moved into its own feature directory under `src/tools/` (e.g., `clarify.js` → `clarify/index.js`)
- Each feature directory contains an `index.js` that exports the tool's public API
- Tool-specific helpers (parsers, validators, providers) remain as siblings within their feature directory
- The central `src/tools/index.js` import paths are updated to reflect new directory structure
- `common.js` is kept flat as a shared utility used across many tools
- No functionality, exports, or behavior changes — purely structural

## Capabilities

### New Capabilities

- `tools-organization`: Defines the canonical directory structure for `src/tools/`, requiring every tool to live in its own feature directory with an `index.js` entry point. Establishes naming conventions, re-export patterns, and the role of `common.js` as the shared utility layer.

### Modified Capabilities

<!-- No existing capability specs are modified — this is a structural refactor with no behavior changes. -->

## Impact

- **Affected code:** `src/tools/index.js` (all import paths), ~25 tool files (moved into directories), `fileCreate/pptx.js` (renamed to `index.js`)
- **No API changes:** All exported tool names, permission scopes, and classifications remain identical
- **No dependency changes:** No new packages, no version bumps
- **Test impact:** Test files that import from tool paths may need path updates

## Non-goals

- Changing tool logic, functionality, or exported APIs
- Adding new tools or features
- Refactoring `common.js` or moving it into a directory
- Changing the permission or classification system in `index.js`
- Reorganizing other directories (`src/agent/`, `src/memory/`, etc.)
