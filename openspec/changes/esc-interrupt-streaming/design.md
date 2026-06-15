## Context

The Madz TUI uses Ink (React-based terminal UI) with a ReAct agent powered by LangGraph. When the agent streams responses, it uses `agent.streamEvents()` which returns an async iterator. The current 'esc' key handler in `src/tui/app.js` calls `handleQuit()` which sets `isQuittingRef.current = true` and calls `process.exit(0)`, terminating the entire application.

Users need a way to interrupt the agent's streaming response without quitting the application. This is particularly important when the model is "choosing violence" (as noted in the issue) or taking too long to respond.

## Goals / Non-Goals

**Goals:**
- Allow 'esc' to interrupt the ReAct agent's streaming when active
- Display partial response content up to the point of interruption
- Return control to the user for new input without exiting the application
- Preserve existing 'esc' behavior when NOT streaming (onboarding, banner, idle)

**Non-Goals:**
- Adding new keyboard shortcuts beyond 'esc'
- Modifying the ReAct agent's core logic or tool execution behavior
- Implementing a full cancellation token pattern (overkill for this use case)
- Supporting multiple concurrent streams (not applicable in current architecture)

## Decisions

### Decision 1: Use Ref-based Signaling Instead of State
**Choice:** Use `useRef` for `isStreamingRef` and `interruptRef` instead of `useState`.
**Rationale:** 
- Refs don't trigger re-renders, which is important for high-frequency interrupt signals
- Refs are always fresh (no stale closures in async callbacks)
- Simpler than managing state transitions for interrupt signals

### Decision 2: Check Interrupt Signal in Stream Loop
**Choice:** Check `interruptRef.current` at the start of each iteration in the `for await` loop in `callReactAgentStreaming`.
**Rationale:**
- Minimal changes to existing code structure
- The async iterator will naturally stop when the loop breaks
- No need to modify the LangGraph streamEvents API
- Alternatives considered:
  - Using AbortController: Would require wrapping the stream, more complex
  - Throwing an error: Would require try/catch around the entire loop, messy
  - Closing the stream: Not directly supported by LangGraph's streamEvents API

### Decision 3: Pass Interrupt Signal Through Callback Closure
**Choice:** Pass the interrupt ref through the streaming callback closure in `dispatchProvider` → `callProvider` → `callReactAgentStreaming`.
**Rationale:**
- The streaming callback is already passed through this chain
- Adding an interrupt ref to the callback's closure is minimal overhead
- Alternatives considered:
  - Global variable: Not testable, not clean
  - Event emitter: Overkill for a single signal
  - Promise-based: Would require restructuring the async flow

### Decision 4: Clean Up State After Interruption
**Choice:** After breaking the stream loop, update the message state to mark it as non-streaming and clear the interrupt ref.
**Rationale:**
- Ensures the UI shows a consistent state (no cursor blinking in partial response)
- Prevents the interrupt signal from affecting subsequent operations
- The partial content is preserved in `committedContent` and `committedReasoning`

## Risks / Trade-offs

### Risk 1: Race Condition on Interrupt Signal
**Impact:** Interrupt signal might be missed if checked at the wrong time.
**Mitigation:** The signal is checked at the start of each iteration, so it will be caught on the next event. The stream will complete its current event and then stop.

### Risk 2: Partial Tool Call State
**Impact:** If interrupted during a tool call, the tool's partial results might be displayed.
**Mitigation:** The tool call display is updated incrementally, so partial results are already visible. The message will show whatever was accumulated.

### Risk 3: Resource Leak from Unclosed Stream
**Impact:** The async iterator might not be properly cleaned up.
**Mitigation:** Breaking the `for await` loop will cause the iterator to be garbage collected. LangGraph's streamEvents should handle cleanup when the iterator is no longer consumed.

### Risk 4: State Inconsistency
**Impact:** Message state might show streaming=true after interruption.
**Mitigation:** The streaming callback checks `isQuittingRef.current` and `interruptRef.current` and stops updating. The message state is updated atomically in each callback invocation.
