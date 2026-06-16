## Context

The TUI is built on Ink + ink-scroll-view with a flat 17-file structure in `src/tui/`. The current `app.js` uses eight independent `useState` calls, streaming logic is inline in handlers, and a panel system exists that contradicts the TUI blueprint's "no panels" philosophy. The TUI blueprint (`docs/TUI.md`) documents the intended architecture including state consolidation, hook extraction, file reorganization, and panel removal.

## Goals / Non-Goals

**Goals:**
- Consolidate state into a single `useReducer` with typed actions and `TUIState` interface
- Extract streaming logic into a dedicated `useStreaming()` hook
- Reorganize file structure into concern-based directories (`state/`, `hooks/`, `components/`, `utils/`)
- Remove the panel system entirely — skills and memory accessed via commands
- Refactor command parser to event-driven registry pattern
- Add runtime toggle indicators to the status bar

**Non-Goals:**
- Changing the streaming data flow (dispatchProvider → callProvider → streamEvents)
- Modifying the session management layer
- Adding new TUI features beyond what the blueprint describes
- Changing the message rendering pipeline (marked + marked-terminal)

## Decisions

### 1. useReducer over useState
**Decision:** Consolidate all TUI state into a single `useReducer` with a `TUIState` interface.
**Rationale:** The blueprint explicitly calls this out. Eight independent state calls cause scattered renders and make reasoning about state transitions harder. A reducer provides a single source of truth and makes testing state logic straightforward.
**Alternatives considered:** `zustand` or `jotai` — but these add external dependencies for a problem solvable with React built-ins.

### 2. Streaming hook extraction
**Decision:** Create `useStreaming()` hook that manages `AbortController` lifecycle, transforms stream events into state updates, and handles the auto-continue circuit breaker.
**Rationale:** The streaming callback is currently set up inline in `handleChat()` / `handleCommand()` and passed through multiple layers. A hook encapsulates the complexity and exposes a clean `streamingState` object.
**Alternatives considered:** Context provider — but a hook is simpler and doesn't require restructuring the component tree.

### 3. File structure reorganization
**Decision:** Group files by concern into `state/`, `hooks/`, `components/`, `utils/` directories.
**Rationale:** Predictability. When looking for streaming logic, you know exactly where to look. The blueprint provides a detailed target structure.
**Alternatives considered:** Keep flat structure — but the blueprint notes this doesn't scale.

### 4. Panel system removal
**Decision:** Remove `panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js` entirely.
**Rationale:** Contradicts the blueprint's core philosophy ("No panels, no tabs, no switching"). Skills and memory are accessible via commands that produce output in the conversation stream.
**Risk:** The existing `tui-interface` spec has panel-based navigation requirements. These must be updated.

### 5. Command registry pattern
**Decision:** Replace switch-driven dispatch table with a command registry where commands are registered as objects with `validate`, `execute`, and `help` properties.
**Rationale:** Adding a new command becomes a registration, not a switch case edit. More testable and extensible.
**Alternatives considered:** Keep the current dispatch table — but it's harder to test and extend.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Large refactor in one change increases risk of regressions | Execute in phases per tasks.md. Each task is independently testable. |
| Panel removal breaks existing `tui-interface` spec | Update spec to reflect command-based access. Update scenarios. |
| `useReducer` migration may introduce subtle state bugs | Comprehensive reducer tests. All existing tests must pass. |
| File reorganization may break imports across the codebase | Careful import updates. Run full test suite after each phase. |
| Command registry rewrite may miss edge cases in parsing | Preserve existing command behavior. New tests cover all commands. |

## Migration Plan

1. **Phase 1:** Create new file structure skeleton (directories, type definitions)
2. **Phase 2:** Implement `useReducer` and migrate state from `useState`
3. **Phase 3:** Extract `useStreaming()` hook
4. **Phase 4:** Refactor command parser to registry pattern
5. **Phase 5:** Remove panel system and update consumers
6. **Phase 6:** Relocate files to new directory structure
7. **Phase 7:** Add toggle indicators to status bar
8. **Phase 8:** Final integration testing and cleanup

Each phase should be independently testable. Commit and push after each phase.

## Open Questions

1. Should the `OnboardingPanel` be moved to `panels/` (retained) or refactored into a command-based flow? The blueprint keeps it but removes other panels.
2. The blueprint mentions format specifiers (`/fset`) and message-level filtering (`/level`) but marks them YAGNI. Should these be excluded entirely from the spec?
3. Should the command registry support async commands? The blueprint shows `execute` returning `Promise<void> | void`.
