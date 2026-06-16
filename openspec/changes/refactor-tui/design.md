## Context

The current TUI (`src/tui/`) is a 17-file flat structure built on Ink + ink-scroll-view. It uses React's `useState` for state management (8 independent calls), inline streaming callbacks, and a switch-driven command parser. The panel system (`panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`) contradicts the blueprint's core philosophy. As the TUI grows, these structural decisions compound: state updates are uncoordinated, streaming logic is duplicated, and navigation to find code requires scanning the entire directory.

## Goals / Non-Goals

**Goals:**
- Consolidate state into a single `useReducer` with typed actions and selectors
- Extract streaming logic into a reusable `useStreaming()` hook
- Reorganize file structure by concern for predictable navigation
- Remove the panel system entirely, replacing with command-based output
- Replace the switch-driven command parser with an event-driven registry pattern
- Implement runtime toggle system (`/toggle`) for config overrides

**Non-Goals:**
- Changing the core rendering approach (Ink + ink-scroll-view stays)
- Adding new external dependencies
- Rebuilding the structured logger or session management
- Changing the message display model or markdown rendering pipeline

## Decisions

### 1. `useReducer` over `useState`
**Decision**: Consolidate all TUI state into a single `useReducer` with a `TUIState` interface.
**Rationale**: Eight independent `useState` calls cause uncoordinated re-renders. When a message arrives, `messages`, `statusMessage`, `contextSize`, and `chatHistory` all update separately. A reducer ensures one state tree, one render cycle per meaningful change.
**Alternatives considered**: `useReducer` with multiple dispatchers (more complex), Zustand (adds dependency — rejected per non-goals).

### 2. `useStreaming()` Hook
**Decision**: Extract streaming callback, AbortController lifecycle, auto-continue circuit breaker, and event transformation into a dedicated `useStreaming()` hook.
**Rationale**: The streaming callback is currently set up inline in `handleChat()` / `handleCommand()` and passed through multiple layers. A hook separates *how we stream* from *what we stream*, making the logic testable and reusable.
**Alternatives considered**: Context provider (overkill for single-consumer), custom event emitter (adds complexity).

### 3. File Structure by Concern
**Decision**: Group files into `state/`, `hooks/`, `components/`, `panels/`, `utils/`.
**Rationale**: Predictability over dogma. When looking for streaming logic, you know exactly where to look. The current flat 17-file layout works for now but doesn't scale.
**Alternatives considered**: Feature-based grouping (overkill for a TUI), keeping flat structure (defers the problem).

### 4. Panel System Removal
**Decision**: Remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` entirely.
**Rationale**: These contradict the blueprint's philosophy: "No panels, no tabs, no switching." Skills and memory inspection should be commands (`/skills`, `/memory`) that produce output in the conversation stream.
**Alternatives considered**: Deprecate with warnings (delays the inevitable), keep with deprecation path (adds maintenance burden).

### 5. Event-Driven Command Registry
**Decision**: Replace the switch-driven dispatch table with a command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.
**Rationale**: Adding a new command becomes a registration, not a switch case edit. More extensible, more testable.
**Alternatives considered**: Keep switch-driven (simpler but less extensible), plugin system (overkill).

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| State migration breaks existing behavior | Comprehensive unit tests for all action types and edge cases before migration |
| Hook extraction changes streaming timing | Integration tests verify streaming callback behavior matches current implementation |
| Panel removal affects users who rely on panel navigation | Commands `/skills` and `/memory` produce equivalent output in the conversation stream |
| File reorganization causes merge conflicts with in-progress work | Coordinate with any active branches; reorganization is mechanical (move + update imports) |
| Command registry adds abstraction overhead | Registry is a simple `Record<string, Command>` — minimal overhead, significant extensibility gain |

## Migration Plan

1. **Phase 1**: Create new file structure skeleton (directories, type definitions)
2. **Phase 2**: Implement `useReducer` with all action types and selectors
3. **Phase 3**: Extract `useStreaming()` hook with event transformation
4. **Phase 4**: Reorganize files into new structure (move + update imports)
5. **Phase 5**: Remove panel system, add `/skills` and `/memory` commands
6. **Phase 6**: Replace command parser with event-driven registry
7. **Phase 7**: Add runtime toggle system (`/toggle`)
8. **Phase 8**: Run full test suite, verify 100% coverage on new files

## Open Questions

- Should the command registry support async commands only, or both sync and async?
- Should runtime toggle overrides persist across sessions (write to a small JSON file) or remain in-memory only?
- Should the `useStreaming()` hook expose a `streamingState` object or just update the reducer directly?
