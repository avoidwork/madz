## Context

The madz agent harness has two invocation modes:
- **TUI mode**: Uses `callReactAgentStreaming()` with a rich callback pipeline that streams text, tool events, reasoning content, and compaction events to the terminal UI. Loop detection is active.
- **Non-TUI (CLI) mode**: Uses `agent.invoke()` directly, which blocks until completion. No streaming, no loop detection.

The streaming pipeline is fully built and tested — it's the TUI path. The non-TUI path is a separate, simpler code path that bypasses streaming entirely. This creates an inconsistency: loop detection (issue 418) only works in TUI mode.

## Goals / Non-Goals

**Goals:**
- Always use the streaming pipeline regardless of invocation mode
- Provide a simple stdout callback for non-TUI mode that writes text chunks in real-time
- Enable loop detection in non-TUI mode
- Preserve all existing TUI behavior unchanged

**Non-Goals:**
- No config flag to toggle streaming (always on)
- No changes to TUI callback behavior
- No new event types — reuse existing callback contract
- No changes to the streaming pipeline itself

## Decisions

### Decision 1: Always pass a callback to `callReactAgentStreaming()`
**Rationale:** The streaming pipeline is the more capable path — it handles loop detection, compaction events, and real-time output. The non-streaming `agent.invoke()` path is simpler but missing features. Since the streaming path already exists and is well-tested, making it the default eliminates code duplication and feature parity issues.

**Alternatives considered:**
- Keep both paths, add a config flag → adds complexity for marginal benefit
- Replace `agent.invoke()` entirely → risky, could break edge cases

### Decision 2: Create a simple `createStdoutCallback()` factory
**Rationale:** A factory function (rather than a single callback) allows future extensibility — e.g., `createStdoutCallback({ includeTools: true })` — while keeping the default minimal. The callback only handles `text` and `loop_detected` events; other events (tool_start, tool_end, reasoning, compaction) are silently ignored in non-TUI mode since they're TUI-specific.

**Alternatives considered:**
- Inline the callback logic in `callReactAgent()` → less reusable, harder to test
- Create a separate `callReactAgentNonTUI()` function → code duplication

### Decision 3: Route `loop_detected` to stderr
**Rationale:** Loop detection warnings should not mix with agent output. Stderr keeps them separate and allows users to pipe stdout to a file while still seeing loop warnings in the terminal.

## Risks / Trade-offs

- **[Risk]** Non-TUI users now see real-time output where they previously saw nothing → **Mitigation:** This is the intended behavior and matches user expectations for CLI tools
- **[Risk]** The aggregated text from streaming must match the previous `agent.invoke()` output → **Mitigation:** `callReactAgentStreaming()` already returns `{ content: aggregatedText || originalMessage }`, same shape as before
- **[Risk]** Edge cases in the streaming path not covered by existing tests → **Mitigation:** Add specific tests for non-TUI streaming behavior

## Migration Plan

No migration needed — this is a transparent change. The API contract (`callReactAgent()` returns `{ content: string }`) is unchanged. TUI mode is unaffected.

## Open Questions

None. The streaming pipeline is already production-tested in TUI mode. The only change is making it the default for all invocations.