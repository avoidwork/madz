## Why

The current `loadContext` function does not distinguish between persistent and ephemeral memories, mixing all `.md` files together during processing. This means short-lived, temporary context can dilute important persistent context (profile, long-term memories) in the system prompt. Additionally, the context output from `loadContext` is not wired into the system prompt generation pipeline, so the LLM doesn't see the current memory state as part of its system prompt.

## What Changes

- Refactor `loadContext` in `src/memory/context.js` to filter out ephemeral files during the main processing loop
- Add a final step in `loadContext` to load a limited set of ephemeral memories after all persistent context
- Wire `loadContext` output into `loadSystemPrompt` in `src/memory/prompts.js` so context is appended to `SYSTEM_PROMPT.md`
- Add configurable `memory.ephemeralLimit` setting (default: 5) to control how many ephemeral memories are loaded

## Capabilities

### New Capabilities
- `context-priority`: Load profile.md first, persistent context second, ephemeral last in `loadContext`

### Modified Capabilities
- `system-prompt`: Append context output from `loadContext` to `SYSTEM_PROMPT.md` in `loadSystemPrompt`

## Impact

- `src/memory/context.js` — `loadContext` function refactored
- `src/memory/prompts.js` — `loadSystemPrompt` function modified to append context
- `config.yaml` — new `memory.ephemeralLimit` option
- `src/config/schemas.js` — schema validation for new config option
- `src/config/loader.js` — may need to load new config option