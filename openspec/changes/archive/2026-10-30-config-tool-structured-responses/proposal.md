# Proposal

## Why

The `config` tool (`getConfigImpl` in `src/tools/config/index.js`) currently returns `JSON.stringify(config, null, 2)`, wrapping the result in a string and forcing consumers to parse it back into an object. Other tools in the codebase (e.g. `web`, `image`, `calendar`, `json`) return native structured objects (`{ ok: boolean, ... }`). The `config` tool should be consistent: return a self-describing structured object and remove the need for string parsing.

## What Changes

- `getConfigImpl` returns a native structured object on success: `{ ok: true, config }` where `config` is the parsed config object (not a string).
- `getConfigImpl` returns `{ ok: false, error: <message> }` on failure instead of propagating an unhandled rejection. The `loadConfig()` call is wrapped in try/catch.
- The JSDoc `@returns` annotation is updated from `Promise<string>` to `Promise<{ ok: boolean, config?: object, error?: string }>`.
- `tests/unit/tools/getConfig.test.js` is updated to assert the new structured shape (`result.ok`, `result.config`) and to cover the failure path (`{ ok: false, error }`).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `getconfig-tool`: The `getConfig` tool's response contract changes. The "getConfig returns parsed config" requirement is updated so the tool returns `{ ok: true, config }` rather than a stringified JSON. The "Error propagation" requirement is replaced: the tool now catches `loadConfig()` errors and returns `{ ok: false, error }` instead of throwing.

## Impact

- `src/tools/config/index.js` — `getConfigImpl` return shape and JSDoc.
- `tests/unit/tools/getConfig.test.js` — updated assertions and new failure-path coverage.
- No new dependencies; pure refactor of existing code.

## Non-goals

- No change to `src/config/loader.js` or `loadConfig()` behavior.
- No change to other tools or the tool registry.
- No change to the `config` tool's metadata (name, description, strict zod schema).
