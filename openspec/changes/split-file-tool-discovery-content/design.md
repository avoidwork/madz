## Context

The `file` tool (`src/tools/file/index.js`) currently exposes seven actions: `read`, `write`, `edit`, `delete`, `ls`, `glob`, `grep`. It also hosts the shared content-search implementation `grepImpl` (with its `nativeSearch` fallback) and the path-resolution helpers `resolveBaseDir`/`resolveFilePath`. The standalone `grep` tool (`src/tools/grep/index.js`) imports `grepImpl` directly from `file/index.js`, creating a cross-tool dependency.

This conflates three access classes — discovery (`ls`/`glob`), content search (`grep`), and content mutation (`read`/`write`/`edit`/`delete`) — into a single tool. The sandbox permission model (`TOOL_PERMISSIONS` in `src/tools/index.js`) grants `file` both `filesystem:read` and `filesystem:write`, so a context granted `file` access gets discovery and search too.

## Goals / Non-Goals

**Goals:**
- Split `file` along the access boundary into a `discovery` tool (path listing only) and a content-access `file` tool.
- Break the cross-tool dependency so no tool module imports from another tool module.
- Preserve the standalone `grep` tool as the single content-search path.
- Keep the `edit` action (not redundant with `write`).

**Non-Goals:**
- Splitting `ls` and `glob` into separate tools.
- Folding `grep` into `discovery`.
- Removing the `edit` action.
- Changing the `grep` tool's behavior.

## Decisions

### Decision 1: Move shared helpers to `src/tools/common.js`
`common.js` already hosts `validatePath`, `checkFileLimit`, `parseSizeString`, `validateUrl`, and `fetchWithTimeout`. It is the natural home for shared tool plumbing. Move `grepImpl`, `nativeSearch`, `resolveBaseDir`, and `resolveFilePath` here. `resolveBaseDir`/`resolveFilePath` depend on `getProjectCwd` (`../../workspace/project.js`) and `loadConfig` (`../../config/loader.js`); both are already imported elsewhere in the tool layer, so no new circular dependency is introduced.

**Alternatives considered:**
- Keeping helpers in `file/index.js` and having `grep`/`discovery` import from it — rejected; this perpetuates the cross-tool dependency.
- Creating a new `src/tools/shared.js` — rejected; `common.js` already serves this role.

### Decision 2: Create `src/tools/discovery/index.js`
A new tool module exposing `ls` and `glob`. It imports `resolveFilePath` and `validatePath` from `../common.js` and hosts `lsImpl`, `globImpl`, and the private `globToRegex` helper. Registered with `["filesystem:read"]` — path listing only, no content read.

**Alternatives considered:**
- Splitting `ls` and `glob` into two tools — rejected as over-fragmentation; they share a conceptual purpose and code path.
- Folding `grep` into `discovery` — rejected; `grep` reads content, `discovery` touches paths only.

### Decision 3: Simplify `file` to content access only
Set `VALID_ACTIONS` to `["read", "write", "edit", "delete"]`. Remove the `ls`/`glob`/`grep` cases from `fileImpl`. Remove the stale `search` reference from the description. Drop `pattern`/`maxResults` from the schema. Keep `edit`.

**Alternatives considered:**
- Removing `edit` — rejected; `edit` applies a targeted delta and verifies `oldString` exists, catching drift that a stale `write` would silently clobber.

### Decision 4: Register `discovery` in `src/tools/index.js`
Add `discovery` to `ORCHESTRATOR_TOOLS`, the `TOOLS` map, `TOOL_PERMISSIONS` (`["filesystem:read"]`), and a permission switch case. The `file` permission stays `["filesystem:read", "filesystem:write"]`.

## Risks / Trade-offs

- **[Risk] Moving `resolveBaseDir`/`resolveFilePath` changes their import origin.** → Mitigation: `file`, `discovery`, and existing tests all import from `common.js`; no behavior change, only import path.
- **[Risk] `globToRegex` is private to `file/index.js`.** → Mitigation: move it into `discovery/index.js` alongside `globImpl`, its only consumer.
- **[Risk] Existing callers using `file` with `ls`/`glob`/`grep`/`search` break.** → Mitigation: this is a deliberate BREAKING change; the `discovery` tool and standalone `grep` tool cover the removed actions.
- **[Risk] Circular import between `common.js` and config/workspace.** → Mitigation: `common.js` already imports from `../sandbox/`; adding `../../config/loader.js` and `../../workspace/project.js` introduces no cycle (these modules do not import from `tools/`).
