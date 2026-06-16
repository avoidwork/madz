## Context

The TUI (`src/tui/`) is the primary user-facing interface for madz. It uses Ink + `ink-scroll-view` + a structured logger. The current implementation works but has structural debt:

- `app.js` has 8 independent `useState` calls with no coordination
- Streaming callback is set up inline in `handleChat()` / `handleCommand()` and passed through multiple layers
- Flat 17-file layout in `src/tui/` — no grouping by concern
- Panel system (`panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`) contradicts the blueprint's "no panels" philosophy
- Command parser is a switch-driven dispatch table, not extensible

The blueprint (`docs/TUI.md`) defines the target architecture. This design bridges the gap between current state and that target.

## Goals / Non-Goals

**Goals:**
- Consolidate all TUI state into a single `useReducer` with `TUIState` interface
- Extract streaming logic into `useStreaming()` hook with clean AbortController lifecycle
- Reorganize file structure into `state/`, `hooks/`, `components/`, `utils/` directories
- Remove the panel system entirely; move panel functionality to commands
- Refactor command parser to event-driven registry pattern
- Add runtime toggle system with `/toggle` commands and status bar indicators
- Maintain 100% test coverage on all new files; existing tests must pass

**Non-Goals:**
- Format customization system (YAGNI per blueprint)
- Message-level filtering (YAGNI per blueprint)
- Changing the component hierarchy (App → ConversationPanel + StatusBar + InputPanel stays the same)
- Modifying the structured logger, tiktoken calculation, or `ink-scroll-view` usage
- Changing the AI provider integration layer

## Decisions

### 1. `useReducer` over `useState` — Decision: Yes
**Rationale:** Eight independent state variables that update together (messages, statusMessage, contextSize, chatHistory) create race conditions and unnecessary re-renders. A single reducer with a `TUIState` interface gives us one render cycle per meaningful change and makes state transitions explicit through action types.

**Alternatives considered:**
- `useReducer` with context — overkill for a single component tree
- Zustand/Jotai — adds external dependency for what can be solved with built-in React

### 2. Streaming Hook — Decision: `useStreaming()` returning `streamingState` object
**Rationale:** The streaming callback currently lives inline, passed through `handleChat()` → `dispatchProvider` → `callProvider` → `callReactAgentStreaming`. Extracting it into a hook that manages the AbortController lifecycle, translates stream events into state transitions, and exposes a clean `streamingState` object separates *how we stream* from *what we stream*.

**Alternatives considered:**
- Context provider — adds unnecessary abstraction layer
- Separate service class — over-engineering for a single-consumer hook

### 3. File Structure — Decision: Group by concern
**Rationale:** A flat 17-file layout doesn't scale. Grouping by concern (`state/`, `hooks/`, `components/`, `utils/`) means when you're looking for streaming logic, you know exactly where to look. This is about predictability, not dogma.

**Target structure:**
```
src/tui/
├── app.js              # Root component, providers, reducer
├── state/
│   ├── reducer.js      # useReducer implementation, all action handlers
│   ├── types.js        # TUIState, TUIAction, Message interfaces
│   └── selectors.js    # Derived state (contextSize, statusMessage, etc.)
├── hooks/
│   ├── useStreaming.js # AbortController, event transformation, auto-continue
│   ├── useScroll.js    # ScrollView ref, resize handling, keyboard scroll
│   ├── useInput.js     # Keyboard routing (scroll vs history vs input)
│   └── useCommand.js   # Command parsing + dispatch
├── components/
│   ├── ConversationPanel.js
│   ├── InputPanel.js
│   ├── StatusBar.js
│   ├── MessageBubble.js
│   └── Banner.js
├── panels/
│   └── OnboardingPanel.js  # Only panel that stays
├── utils/
│   ├── commandParser.js    # Command registry, dispatch table
│   ├── contextTokens.js    # tiktoken token calculation
│   ├── markdownText.js     # marked + marked-terminal rendering
│   └── format.js           # Format specifiers, toggle logic
└── index.js
```

### 4. Panel Removal — Decision: Remove all panels except OnboardingPanel
**Rationale:** The blueprint's core philosophy is "no panels, no tabs, no switching." The skills, memory, and settings panels contradict this. Their functionality moves to commands (`/skills`, `/memory`, `/config`) that produce output in the conversation stream. OnboardingPanel stays because it's a first-run flow, not a navigation surface.

### 5. Command Registry — Decision: Event-driven with validate/execute/help
**Rationale:** The current switch-driven dispatch table requires editing the parser to add commands. An event-driven registry where commands are registered as objects with `validate`, `execute`, and `help` properties makes adding new commands a registration, not a switch case edit.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Reducer complexity — single reducer handling all TUI state could become unwieldy | Split into named reducers (messagesReducer, inputReducer, etc.) composed with `combineReducers`-style pattern |
| Streaming hook abstraction leaks implementation details | Keep the hook's public API minimal: `streamingState` object + `startStreaming()` / `abort()` methods |
| Panel removal breaks existing tests | All panel-related tests move to command tests; OnboardingPanel tests stay |
| File relocation causes merge conflicts during transition | Do all moves in a single commit; no incremental refactoring |
| Toggle system adds UI complexity | Start with 5 toggles only; format specifiers and message filtering deferred (YAGNI) |

## Migration Plan

1. **Phase 1 — State consolidation:** Create `state/types.js`, `state/reducer.js`, `state/selectors.js`. Migrate `app.js` from `useState` to `useReducer`.
2. **Phase 2 — Streaming extraction:** Create `hooks/useStreaming.js`. Extract streaming callback from `handleChat()`/`handleCommand()`.
3. **Phase 3 — File reorganization:** Move files to new directory structure. Update all imports.
4. **Phase 4 — Panel removal:** Delete `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`. Move their functionality to commands.
5. **Phase 5 — Command registry:** Rewrite `commandParser.js` as event-driven registry.
6. **Phase 6 — Runtime toggles:** Add toggle commands and status bar indicators.
7. **Phase 7 — Tests:** Write new tests for reducer, streaming hook, command registry. Verify all existing tests pass.

## Open Questions

1. Should the reducer be a single `reducer.js` or split into named sub-reducers composed together?
2. What's the exact API surface of `useStreaming()` — should it return a hook or a custom hook factory?
3. Should toggle overrides persist to `config.yaml` on exit, or remain in-memory only? (Blueprint says in-memory only.)
