## Why

Non-TUI (CLI) invocations of madz currently use `agent.invoke()` which returns only after the agent completes. This means no real-time output and no loop detection — the agent can get stuck in repetitive loops with no way to detect or nudge it. The streaming pipeline already exists and works perfectly for TUI mode; non-TUI mode simply bypasses it.

## What Changes

- Modify `callReactAgent()` in `src/agent/react.js` to always use the streaming pipeline
- Create a default stdout callback (`createStdoutCallback()`) that writes text chunks to stdout
- Route `loop_detected` events to stderr for non-TUI mode
- TUI mode remains unchanged — user-provided callbacks take precedence
- No config flag — streaming is always on

## Capabilities

### New Capabilities
- `streaming-non-tui`: Enable streaming output and loop detection for non-TUI CLI invocations via a default stdout callback

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- `src/agent/react.js` — `callReactAgent()` entry point, new `createStdoutCallback()` function
- `src/agent/loop-detector.js` — loop detection now active in non-TUI mode (already wired into streaming)
- `tests/unit/react_agent.test.js` — new tests for stdout callback and non-TUI streaming behavior
- No API changes — `callReactAgent()` still returns `{ content: string }`
- No new dependencies