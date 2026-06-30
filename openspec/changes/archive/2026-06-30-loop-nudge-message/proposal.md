## Why

When the agent enters a repetitive loop, the system detects it via turn hash tracking but only displays a UI nudge ("You're looping.") to the user. The agent itself never receives feedback that it is stuck, so it continues looping indefinitely. This means the agent wastes resources and provides a poor user experience when it gets stuck in repetitive patterns.

## What Changes

- Inject a configurable nudge message into the conversation when a loop is detected, so the agent can see it and try a different approach.
- Add two new configuration fields under `agent` in `config.yaml`:
  - `loopMsg` (string, optional) — The nudge message to inject. Resolves to `AGENT_LOOP_MSG` env var.
  - `loopLimit` (number, optional, default: 5) — Maximum number of loop nudge messages to inject. Resolves to `AGENT_LOOP_LIMIT` env var.
- Track nudge count in session state to enforce the limit.
- The nudge is injected as a `user` message so the agent sees it as conversation input.
- The existing UI nudge display continues to work independently.

## Capabilities

### New Capabilities
- `loop-nudge`: Inject a configurable nudge message into the conversation when a loop is detected, with a configurable maximum count.

### Modified Capabilities
<!-- No existing capabilities have spec-level requirement changes -->

## Impact

- `src/agent/react.js` — Loop detection logic (`checkTurnHash` function), needs to inject nudge message into conversation.
- `src/config/loader.js` — Config loading, no changes needed (env var resolution already handles nested keys).
- `src/config/schemas.js` — Config schema validation, needs new fields for `loopMsg` and `loopLimit`.
- `src/tui/app.js` — Existing UI nudge handling, no changes needed.
- `config.yaml` — New config fields under `agent`.
- Session state — May need to track nudge count.