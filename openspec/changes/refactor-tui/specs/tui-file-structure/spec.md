## ADDED Requirements

### Requirement: Organized File Structure
The TUI file structure SHALL be organized by concern into the following directories under `src/tui/`:

- `state/` — `reducer.js`, `types.js`, `selectors.js`
- `hooks/` — `useStreaming.js`, `useScroll.js`, `useInput.js`, `useCommand.js`
- `components/` — `ConversationPanel.js`, `InputPanel.js`, `StatusBar.js`, `MessageBubble.js`, `Banner.js`
- `panels/` — `OnboardingPanel.js`
- `utils/` — `commandParser.js`, `contextTokens.js`, `markdownText.js`, `format.js`

#### Scenario: State files are grouped in state/
- **WHEN** a developer looks for state management code
- **THEN** they find `reducer.js`, `types.js`, and `selectors.js` in `src/tui/state/`

#### Scenario: Hook files are grouped in hooks/
- **WHEN** a developer looks for streaming logic
- **THEN** they find `useStreaming.js` in `src/tui/hooks/`

#### Scenario: Component files are grouped in components/
- **WHEN** a developer looks for UI components
- **THEN** they find `ConversationPanel.js`, `InputPanel.js`, `StatusBar.js`, `MessageBubble.js`, and `Banner.js` in `src/tui/components/`

### Requirement: Import Path Updates
All import paths within the TUI SHALL be updated to reflect the new file structure after reorganization.

#### Scenario: App component imports from new locations
- **WHEN** `app.js` imports state and hook modules
- **THEN** imports use the new paths: `../state/reducer`, `../hooks/useStreaming`, etc.

#### Scenario: No circular dependencies introduced
- **WHEN** the file structure is reorganized
- **THEN** no circular import dependencies exist between modules

### Requirement: Session & Persistence Integration
The TUI SHALL integrate with the session layer for message persistence and context token calculation.

#### Scenario: Session lifecycle is managed by SessionStateManager
- **WHEN** the TUI receives a user message
- **THEN** `sessionState.addExchange({ role: "user", content })` is called

#### Scenario: Agent responses are persisted
- **WHEN** the agent returns a response
- **THEN** `sessionState.addExchange({ role: "assistant", content })` is called

#### Scenario: Session is persisted on save
- **WHEN** `onSaveSession` callback is invoked
- **THEN** the session is persisted to `memory/sessions/`

#### Scenario: Context tokens are calculated with tiktoken
- **WHEN** context size needs to be displayed
- **THEN** `tiktoken` calculates tokens with a character-count fallback

#### Scenario: GC integration triggers idle GC
- **WHEN** `gcManager.onActivity` is called after a message exchange
- **THEN** idle GC is triggered if `config.memory.gc.enabled !== false`
