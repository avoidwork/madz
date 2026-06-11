## Why

During long-running sessions — especially those involving large tool outputs, extensive reasoning content, or sessions with hundreds of exchanges — the `messages` array in the TUI, the `sessionState.conversation` array, and the in-memory memory entries accumulate without bound. This leads to Node.js heap pressure and eventual "out of memory" kills, particularly in containerized deployments where memory limits are tight. Currently, conversation trimming only happens at the context-window level when sending to the LLM, but the TUI display state and session state retain all messages indefinitely.

## What Changes

- Introduce an **optimistic garbage collection** mechanism that proactively trims data structures before they become problematic
- Add a configurable `memory.gc` section to `config.yaml` with thresholds for message window size, memory entry limits, and collection intervals
- Trim the TUI `messages` array to a configurable window (default: last 100 messages) during idle periods and after each exchange
- Enforce a maximum entry count on the `memory/context/` directory (default: 100 entries), removing oldest entries when exceeded
- Add a `gcCollect()` utility function that performs all cleanup in a single pass, callable from TUI idle handlers, cron jobs, or explicit commands
- Expose a `:gc` TUI command to trigger manual collection
- The existing `enforceContextWindow` and `trimConversation` functions remain unchanged for LLM-facing context; GC operates on display/persistence layers

## Capabilities

### New Capabilities
- `memory-gc`: Proactive garbage collection for TUI messages, session state, and memory context entries with configurable thresholds and idle-triggered collection

### Modified Capabilities
- `memory-system`: Extended with GC thresholds, idle collection, and `:gc` command — retention policy now includes both age-based and count-based limits with proactive trimming

## Impact

- **Affected code**: `src/tui/app.js` (messages state), `src/tui/conversationPanel.js`, `src/session/stateManager.js`, `src/memory/retention.js`, `src/memory/loadMemories.js`, `index.js` (TUI dispatch)
- **Config**: New `memory.gc` section in `config.yaml`
- **TUI**: New `:gc` command for manual collection
- **No breaking changes** to LLM-facing context windows or existing conversation persistence
