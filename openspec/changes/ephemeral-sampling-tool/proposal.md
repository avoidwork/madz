## Why

The agent lacks a way to capture emotionally salient or high-intensity moments during a session -- experiences of joy, sadness, grief, or strong reinforcement from previously loaded memories. These fleeting contextual signals are lost when the session ends, and the agent has no mechanism to record them for later awareness.

## What Changes

- A new `sampling` tool that writes ephemeral memories to `memory/context/` for high-intensity emotional moments or memory reinforcement events.
- Ephemeral memories carry metadata `ephemeral: true` for identification.
- A session-init cleanup routine that asynchronously filters out and deletes expired ephemeral memories (expired = 7+ days old, calculated to midnight of user's timezone).
- Rate limiting: max 1 ephemeral memory per 60-minute period.
- Capacity limit: max 10 ephemeral memories at any time.
- Configurable TTL and max count via `memory.ephemeral.ttlDays` and `memory.ephemeral.maxEntries` in `config.yaml`.

## Capabilities

### New Capabilities
- `ephemeral-sampling`: Tool for capturing ephemeral emotional/reinforcement memories with TTL-based expiration, rate limiting, and capacity limits.

### Modified Capabilities
- None.

## Impact

- **New files**: `src/tools/sampling.js`, `tests/unit/tools_sampling.test.js`
- **Modified files**: `src/tools/index.js` (tool registration), `config.yaml` memory section, `src/config/schemas.js` (memory schema extension), `src/tools/memory.js` (session-init cleanup hook), `src/memory/index.js` (barrel export), `src/memory/writer.js` (ephemeral support)
- **Config schema**: Adds `memory.ephemeral.ttlDays` (default 7) and `memory.ephemeral.maxEntries` (default 10)
- **Config file**: Adds `memory.ephemeral` section with defaults
- **Tests**: New unit test file, update existing memory tool tests if needed
