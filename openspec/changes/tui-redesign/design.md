## Context

The TUI (`src/tui/`) is a 17-file flat directory with eight independent `useState` calls in `app.js`, inline streaming logic scattered across handlers, panel files that contradict the blueprint's "no panels" philosophy, and a switch-driven command parser that doesn't scale. The TUI works but structural debt compounds with every new feature. The blueprint (`docs/TUI.md`) defines four core tenets: input is primary, output is a log, silence is the default, and batteries are included.

Current state:
- `app.js`: 8 `useState` calls, inline streaming callback, mixed concerns
- `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`: panel system contradicting blueprint
- `commandParser.js`: switch-driven dispatch table
- Flat file structure: no grouping by concern

## Goals / Non-Goals

**Goals:**
- Consolidate state into a single `useReducer` with typed actions and selectors
- Extract streaming logic into a dedicated `useStreaming()` hook
- Reorganize file structure into `state/`, `hooks/`, `components/`, `utils/` directories
- Remove the panel system entirely — replace with command-based output in the conversation stream
- Convert command parser to event-driven registry pattern
- Add runtime toggle commands (`/toggle`) with status bar indicators
- Add keyboard scrolling when input is unfocused

**Non-Goals:**
- Rewriting the markdown rendering pipeline
- Changing the structured logger (pino dual-file)
- Modifying the session management layer
- Adding format customization system (YAGNI per blueprint)
- Adding message-level filtering (YAGNI per blueprint)

## Decisions

### 1. `useReducer` over `useState`
**Decision**: Consolidate all TUI state into a single `useReducer` with a `TUIState` interface.
**Rationale**: Eight independent state calls cause multiple renders per meaningful change. A reducer ensures atomic updates and a single render cycle. The blueprint explicitly calls this out in Section 16.1.
**Alternatives considered**: `useReducer` with separate dispatch functions — rejected because it adds boilerplate without benefit over a single dispatch.

### 2. Extract streaming to `useStreaming()` hook
**Decision**: Move AbortController lifecycle, stream event transformation, and auto-continue circuit breaker into `useStreaming()`.
**Rationale**: The streaming callback is currently set up inline in `handleChat()` / `handleCommand()` and passed through multiple layers. A hook separates *how we stream* from *what we stream*.
**Alternatives considered**: Context provider — rejected because it adds unnecessary indirection for a single-consumer pattern.

### 3. File structure: group by concern
**Decision**: Create `state/`, `hooks/`, `components/`, `utils/` subdirectories.
**Rationale**: Predictability over dogma. When looking for streaming logic, you know exactly where to look. The blueprint Section 16.3 defines the target structure.
**Alternatives considered**: Keep flat — rejected because it doesn't scale and the blueprint explicitly calls this out.

### 4. Remove panel system
**Decision**: Delete `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`. Replace with command-based output.
**Rationale**: The blueprint's core tenet is "no panels, no tabs, no switching." The panel system directly contradicts this. Commands like `/skills` and `/memory` produce output in the conversation stream.
**Alternatives considered**: Keep panels but make them optional — rejected because it adds complexity and the blueprint is explicit.

### 5. Event-driven command registry
**Decision**: Convert `commandParser.js` from switch-driven to event-driven registry.
**Rationale**: Adding a new command becomes a registration, not a switch case edit. More extensible and testable.
**Alternatives considered**: Keep switch-driven — rejected because it doesn't scale and the blueprint explicitly calls this out.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Breaking existing tests due to state shape changes | Update tests alongside implementation; maintain backward-compatible action types |
| Regression in streaming behavior during hook extraction | Write dedicated `useStreaming.test.js` covering all event types, auto-continue, and abort |
| Panel removal breaks user expectations | Commands (`/skills`, `/memory`) produce equivalent output in the conversation stream |
| Reducer complexity grows with new features | Selectors keep derived state logic separate; reducer stays focused on mutations |
| File reorganization causes git blame noise | Commit reorganization and logic changes together so blame points to the final state |

## Migration Plan

1. Create new directory structure (`state/`, `hooks/`, `components/`, `utils/`)
2. Write `state/types.js` with `TUIState` and `TUIAction` interfaces
3. Write `state/reducer.js` with all action handlers
4. Write `state/selectors.js` with derived state functions
5. Write `hooks/useStreaming.js` with streaming logic
6. Write `hooks/useScroll.js` with scroll management
7. Write `hooks/useInput.js` with keyboard routing
8. Write `hooks/useCommand.js` with command parsing
9. Write `utils/commandParser.js` with registry pattern
10. Write `utils/format.js` with toggle logic
11. Rewrite `app.js` to use reducer, hooks, and new structure
12. Remove panel files
13. Update `index.js` entry point
14. Write tests for all new files
15. Run full test suite

## Open Questions

1. Should toggle overrides persist to `config.yaml` on exit, or only on explicit save?
2. Should the command registry support async commands that return promises?
3. Should the streaming hook expose a `streamingState` object or dispatch actions directly?
