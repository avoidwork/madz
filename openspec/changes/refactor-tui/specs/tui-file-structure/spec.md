## ADDED Requirements

### Requirement: TUI files are organized by concern
The TUI file structure SHALL be reorganized from a flat layout into grouped directories: `state/`, `hooks/`, `components/`, `utils/`, with `panels/` retained only for `OnboardingPanel.js`.

#### Scenario: State files are grouped
- **WHEN** the TUI directory is inspected
- **THEN** `state/reducer.js`, `state/types.js`, and `state/selectors.js` exist

#### Scenario: Hook files are grouped
- **WHEN** the TUI directory is inspected
- **THEN** `hooks/useStreaming.js`, `hooks/useScroll.js`, `hooks/useInput.js`, and `hooks/useCommand.js` exist

#### Scenario: Component files are grouped
- **WHEN** the TUI directory is inspected
- **THEN** `components/ConversationPanel.js`, `components/InputPanel.js`, `components/StatusBar.js`, `components/MessageBubble.js`, and `components/Banner.js` exist

#### Scenario: Utility files are grouped
- **WHEN** the TUI directory is inspected
- **THEN** `utils/commandParser.js`, `utils/contextTokens.js`, `utils/markdownText.js`, and `utils/format.js` exist

#### Scenario: Root files remain at top level
- **WHEN** the TUI directory is inspected
- **THEN** `app.js` (root component with reducer), `index.js` (entry point) remain at the top level

### Requirement: All imports are updated to reflect new structure
All internal imports within the TUI SHALL reference the new file paths after reorganization.

#### Scenario: Component imports use new paths
- **WHEN** `app.js` imports components
- **THEN** it uses `./components/ConversationPanel`, `./components/StatusBar`, etc.

#### Scenario: Hook imports use new paths
- **WHEN** `app.js` imports hooks
- **THEN** it uses `./hooks/useStreaming`, `./hooks/useScroll`, etc.

#### Scenario: Utility imports use new paths
- **WHEN** components import utilities
- **THEN** they use `../utils/contextTokens`, `../utils/markdownText`, etc.
