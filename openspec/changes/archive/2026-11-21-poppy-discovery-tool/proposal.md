# Proposal

## Why

madz has no way to begin a Personal Agent Protocol (Poppy) session. Every Poppy interaction starts
with discovery of a company's `/.well-known/poppy.json`; without a discovery tool, no later Poppy
capability (sessions, sign-in, conversations) can be built. See issue #1938.

## What Changes

- Add a first-class `poppy` tool with a `discover` action that fetches and validates a company's
  `poppy.json` and returns a normalized summary.
- Add a server-side `poppy` config section (`PoppySchema`) controlling enablement, rate limit and
  timeout, mirroring the `jira` and `confluence` tools.
- Register the tool in the tool registry with `network:outbound` permission.

## Capabilities

### New Capabilities
- `poppy-tool`: Poppy discovery: HTTPS-only fetch of `/.well-known/poppy.json`, schema validation,
  domain and OAuth issuer verification, and a normalized discovery summary.

### Modified Capabilities

## Impact

- New: `src/tools/poppy/index.js`, `src/config/schemas/poppy.js`, `tests/unit/tools/poppy.test.js`.
- Modified: `src/tools/index.js`, `src/config/config.js`, `src/config/schemas/index.js`, `config.yaml`.
- Transport reuses `makeApiRequest` from `src/tools/api/index.js`. No new dependencies.
