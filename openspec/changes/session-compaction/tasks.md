## 1. Session State Management

- [ ] 1.1 Add `compacted` boolean field and `compactCount` tracking to `SessionStateManager` constructor
- [ ] 1.2 Add `isCompacted()` getter and `setCompacted(flag)` setter to `SessionStateManager`
- [ ] 1.3 Add `clearSession()` method to `SessionStateManager` that resets conversation, flags, and chat history references
- [ ] 1.4 Add `getCompactCount()` getter to track how many compactions have occurred

## 2. Compaction Utility Module

- [ ] 2.1 Create `src/session/compaction.js` with `compactConversation(conversation, systemPrompt, model, providerConfig)` function
- [ ] 2.2 Implement summarization prompt that instructs the LLM to produce a concise summary of the conversation while preserving key facts, decisions, and tool results
- [ ] 2.3 Preserve the last 2 exchanges after the summary message in the returned conversation array
- [ ] 2.4 Return `{ summary: string, preservedExchanges: Array, compactedConversation: Array }` object
- [ ] 2.5 Export `isContextOverflowError(err)` helper that checks for `context_length_exceeded` and equivalent error codes
- [ ] 2.6 Export `shouldCompactionRetry(err)` helper that determines if a failed dispatch warrants a compaction retry

## 3. Command Parser Updates

- [ ] 3.1 Register `:new` command handler in `CommandParser` constructor that triggers session reset and returns `{ action: "new" }`
- [ ] 3.2 Register `:compact` command handler that returns `{ action: "compact" }`
- [ ] 3.3 Update `:help` command text to include `new` and `compact` in the available commands list

## 4. TUI Integration

- [ ] 4.1 Import `compaction.js` module into `src/tui/app.js`
- [ ] 4.2 Handle `:compact` action in `handleCommand`: display "Compacting..." status, call `compactConversation`, replace session state, save to memory, display completion message or error
- [ ] 4.3 Handle `:new` action in `handleCommand`: display "Creating new session..." status, create fresh `SessionStateManager`, clear TUI messages and chat history, display confirmation message
- [ ] 4.4 Add `compacting` boolean state to `app.js` to disable input during compaction

## 5. Dispatch Layer Integration

- [ ] 5.1 Modify `dispatchProvider` in `index.js` to catch context overflow errors and trigger auto-compaction retry
- [ ] 5.2 Implement retry logic: on first overflow error, run compaction, retry dispatch once; on second overflow, return hard error
- [ ] 5.3 Pass system prompt to compaction so the summary includes the agent's instructions
- [ ] 5.4 Export `compactConversation` from `index.js` for use by TUI and dispatch layer

## 6. Memory Persistence

- [ ] 6.1 After manual `:compact`, call `saveSession` to persist the compacted conversation
- [ ] 6.2 After auto-trigger compaction, call `saveSession` in the catch block before retry

## 7. Configuration

- [ ] 7.1 Add configurable `session.compact_recent_exchanges` (default: 2) to `config.yaml` schema in `src/config/schemas.js`
- [ ] 7.2 Make compaction preserve that many recent exchanges instead of hard-coded 2

## 8. Tests

- [ ] 8.1 Create `tests/unit/session/compaction.test.js` with tests for `compactConversation`, `isContextOverflowError`, and `shouldCompactionRetry`
- [ ] 8.2 Add tests for `SessionStateManager` compaction flags (`isCompacted`, `setCompacted`, `clearSession`, `getCompactCount`)
- [ ] 8.3 Add tests for `:new` and `:compact` commands in `tests/unit/tui/commandParser.test.js`
- [ ] 8.4 Add integration test for auto-compaction retry flow in `tests/integration/full-flow.test.js`
