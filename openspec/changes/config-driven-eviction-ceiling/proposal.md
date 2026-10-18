## Why

deepagents' `FilesystemMiddleware` evicts any `ToolMessage` whose stringified content exceeds `toolTokenLimitBeforeEvict * 4` characters (default `2e4` → 80,000 chars). `readImage` returns base64 as plain JSON in the `ToolMessage` content, so any image above ~60 KB raw is replaced by `/large_tool_results/<id>.txt` prose before `ImageDispatch` can build a vision block — `buildImageBlock`'s `JSON.parse` throws, the catch logs `"[imageDispatch] failed to parse readImage tool result; skipping"`, and the model reports it cannot see the image. `image.maxSize` advertises a limit nearly twice as large as what actually survives, and the two numbers drift with no test to catch it.

## What Changes

- Add `src/agent/filesystemMiddleware.js`: derives the eviction ceiling from `image.maxSize` as **base64 characters** (`Math.ceil((maxSize + 128) / 4)`) and builds a replacement middleware via `createFilesystemMiddleware({ backend, permissions, tools, toolTokenLimitBeforeEvict })`.
- Register the replacement in `createDeepAgent({ middleware: [...] })`. Its `name` MUST be exactly `"FilesystemMiddleware"` so `mergeMiddlewareStack`'s same-name Map merge **displaces** the library default rather than stacking a second copy.
- Reproduce the library's full option set — that middleware also supplies the eight filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `delete`, `glob`, `grep`, `execute`). `permissions: []`; `tools` mirrors the library's `computeProfileFilesystemTools` derivation.
- Attach the replacement to each of the 12 inline subagent definitions in `createSubagentDefinitions`, which already receives `config`. Subagents do **not** inherit parent custom middleware (only the auto-injected `general-purpose` subagent does).
- Clamp `image.maxSize` in `src/config/schemas/image.js` and guard the derivation so the ceiling can never be `0`, `NaN`, `Infinity`, or `undefined`.
- No new dependencies, no config keys, no changes to `readImage`'s size check (which stays the primary gate).

## Capabilities

### New Capabilities
- `tool-result-eviction-ceiling`: config-derived governance of deepagents' tool-result eviction ceiling, including same-name middleware displacement, harness-profile tool derivation, subagent inheritance, and the config clamp that keeps the ceiling bounded.

### Modified Capabilities
- `subagent-definitions`: subagent definitions SHALL carry a `FilesystemMiddleware` replacement so inline subagents share the orchestrator's eviction ceiling instead of the library default.

## Impact

- **Code:** `src/agent/filesystemMiddleware.js` (new), `src/agent/deepAgents.js`, `src/config/schemas/image.js`.
- **Tests:** `tests/unit/agent/filesystemMiddleware.test.js` (new), `tests/unit/config/schemas/image.test.js` (new), `tests/integration/evictionCeiling.test.js` (new), assertions added to `tests/unit/deepAgents.test.js`.
- **Dependency:** `deepagents@1.14.2` — `createFilesystemMiddleware`, `getHarnessProfile`, `createHarnessProfile`, `EMPTY_HARNESS_PROFILE` are exported from the package root; `resolveHarnessProfile` is not, so its documented lookup order is re-implemented locally.
- **Behaviour:** `toolTokenLimitBeforeEvict` also threads into `createReadFileTool`, so `read_file`'s own eviction threshold rises to the same ceiling. Intended: one ceiling governs inline tool payloads.
- **Risk:** raising the ceiling raises the maximum inline tool payload. Bounded by the schema clamp plus the derivation guard.

## Non-goals

- Fixing `readImage`'s inverted `encodedLimit = Math.ceil(sizeLimit * 1.33)` (separately tracked).
- Fixing `resizeScreenshot`'s raw-byte budget against the same key (separately tracked).
- Promoting the `"[imageDispatch] failed to parse…"` warn to name the eviction path.
- Switching `readImage` to `responseFormat: "content_and_artifact"` (validated fallback, rejected for changing the public return contract).
- Any new npm package, config key, or postinstall patch.
