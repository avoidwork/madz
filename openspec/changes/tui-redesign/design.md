## Context

The TUI (`src/tui/`) is the primary user-facing interface for the madz agent. It's built on Ink + ink-scroll-view with a structured pino logger. The current implementation works but has accumulated structural debt:

- **State sprawl**: Eight independent `useState` calls in `app.js` with no coordination. A single message arrival triggers four separate state updates across four renders.
- **Inline streaming**: The streaming callback is set up inline in `handleChat()` / `handleCommand()` and passed through multiple layers, mixing streaming concerns with command handling.
- **Flat file layout**: 17 files at the root of `src/tui/` — no grouping by concern, making navigation and onboarding difficult.
- **Panel contradiction**: `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` exist despite the blueprint's core tenet: "No panels, no tabs, no switching."
- **Switch-driven commands**: `commandParser.js` uses a dispatch table with switch-case logic — adding commands requires editing the switch, not registering a new handler.

The TUI uses no external state management library — just React's built-in `useState` and `useRef`. This is sufficient for the current scale but doesn't scale well.

## Goals / Non-Goals

**Goals:**
- Consolidate all TUI state into a single `useReducer` with a `TUIState` interface and typed action types
- Extract streaming logic into a dedicated `useStreaming()` hook with clean state transitions
- Restructure `src/tui/` into a concern-based hierarchy (`state/`, `hooks/`, `components/`, `panels/`, `utils/`)
- Remove the panel system entirely — replace with commands that produce output in the conversation stream
- Refactor command parser to an event-driven registry pattern
- Implement bitchx-inspired `/toggle` runtime configuration system
- Add toggle/filter indicators to the status bar

**Non-Goals:**
- Changing the core philosophy (input is primary, silence is default, etc.)
- Adding new external dependencies
- Changing the streaming pipeline (LangGraph → dispatchProvider → streamingCallback)
- Modifying the session management layer (compaction, trimming, persistence)
- Changing the message bubble rendering (markdown, role colors, tool call display)
- Adding new commands beyond the existing set + `/toggle`

## Decisions

### 1. `useReducer` over `useState`

**Decision**: Consolidate all TUI state into a single `useReducer` with a `TUIState` interface.

**Rationale**: Eight independent `useState` calls create uncoordinated renders. When a message arrives, `messages`, `statusMessage`, `contextSize`, and `chatHistory` all update separately. A single reducer ensures one render cycle per meaningful state change and provides a clear action taxonomy.

**Alternatives considered**:
- `zustand` or `jotai` — adds external dependency for what is essentially local component state
- `useReducer` with separate reducers per domain — over-engineered for a single component tree

### 2. `useStreaming()` hook

**Decision**: Extract all streaming logic into a dedicated hook.

**Rationale**: The streaming callback currently lives inline in `handleChat()` / `handleCommand()`, mixing streaming concerns with command dispatch. A hook encapsulates:
- AbortController lifecycle management
- Stream event → state transition transformation
- Auto-continue circuit breaker logic
- A clean `streamingState` object exposed to the UI

**Alternatives considered**:
- Service class — overkill for what is fundamentally React state management
- Context provider — adds unnecessary indirection for a single-component concern

### 3. File restructuring by concern

**Decision**: Group files into `state/`, `hooks/`, `components/`, `panels/`, `utils/`.

**Rationale**: Predictability. When looking for streaming logic, you know exactly where to look. The current flat layout works for 17 files but doesn't scale.

**Structure**:
```
src/tui/
├── app.js              # Root component, providers, reducer
├── state/              # TUIState, actions, reducer, selectors
├── hooks/              # useStreaming, useScroll, useInput, useCommand
├── components/         # ConversationPanel, InputPanel, StatusBar, MessageBubble, Banner
├── panels/             # OnboardingPanel (only panel that remains)
├── utils/              # commandParser, contextTokens, markdownText, format
└── index.js            # Entry point
```

### 4. Panel removal

**Decision**: Remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`. Replace with commands.

**Rationale**: The blueprint's philosophy is explicit: "No panels, no tabs, no switching." The panel system contradicts this. Skills and memory are inspected via `/skills` and `/memory` commands that produce output in the conversation stream — the natural TUI paradigm.

**OnboardingPanel exception**: This is not a "panel" in the navigation sense — it's a one-time first-run flow. It stays in `panels/` as the sole remaining panel.

### 5. Command registry pattern

**Decision**: Refactor `commandParser.js` to an event-driven registry.

**Rationale**: A switch-driven dispatch table requires editing the switch for every new command. A registry where commands are objects with `validate`, `execute`, and `help` properties makes adding commands a registration, not a code edit.

**Schema**:
```typescript
interface Command {
  name: string;
  description: string;
  usage: string;
  validate: (args: string[]) => boolean | string;
  execute: (args, state, dispatch, helpers) => Promise<void> | void;
}
```

### 6. Runtime toggles in-memory only

**Decision**: Toggle overrides stored in memory. `config.yaml` `tui` section is the source of truth on restart.

**Rationale**: Simpler than persisting to a separate file. The blueprint explicitly states: "No separate `tui-config.json` file is needed."

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Breaking existing tests | All 1129 existing tests must pass. New tests cover all refactored files. |
| Regression in streaming behavior | `useStreaming()` hook is fully unit-testable in isolation. |
| Panel removal breaks user workflows | Panels were unused per the blueprint philosophy. Commands provide equivalent functionality. |
| `useReducer` adds complexity for simple state | The reducer is generated from the existing `useState` calls — the migration is mechanical, not conceptual. |
| File restructuring is a large diff | Each file is moved/created independently. The diff is large but each change is focused. |

## Migration Plan

1. **Phase 1**: Create new file structure (`state/`, `hooks/`, `components/`, `utils/`)
2. **Phase 2**: Migrate state from `useState` to `useReducer` in a new `app.js`
3. **Phase 3**: Extract streaming into `useStreaming()` hook
4. **Phase 4**: Move components to `components/` directory
5. **Phase 5**: Refactor command parser to registry pattern
6. **Phase 6**: Implement `/toggle` command and runtime toggle system
7. **Phase 7**: Remove panel files, add `/skills` and `/memory` commands
8. **Phase 8**: Update status bar with toggle indicators
9. **Phase 9**: Run full test suite, fix any regressions

**Rollback**: The change is entirely within `src/tui/`. If regressions occur, revert the TUI directory and the rest of the system is unaffected.

## Open Questions

1. Should the `/toggle` command support `/toggle <key> <value>` (set to specific value) in addition to `/toggle <key>` (toggle)?
2. Should format specifiers (`/format system "[%T] %BSystem%n: %I%t%n"`) be implemented, or deferred per the YAGNI note in the blueprint?
3. Should message-level filtering (`/level debug`) be implemented, or deferred per the YAGNI note?
