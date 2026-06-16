## ADDED Requirements

### Requirement: Panel system is removed
The panel system (`panels.js`, `skillsPanel.js`, `memoryPanel.js`, `settingsPanel.js`) SHALL be removed entirely, as it contradicts the blueprint's philosophy of "no panels, no tabs, no switching."

#### Scenario: Panel files are deleted
- **WHEN** the refactoring is complete
- **THEN** `src/tui/panels.js`, `src/tui/skillsPanel.js`, `src/tui/memoryPanel.js`, and `src/tui/settingsPanel.js` no longer exist

#### Scenario: Panel imports are removed
- **WHEN** `app.js` is inspected
- **THEN** it contains no imports or references to the removed panel files

#### Scenario: OnboardingPanel is retained
- **WHEN** the TUI directory is inspected
- **THEN** `panels/OnboardingPanel.js` still exists (it is a first-run flow, not a navigation surface)

### Requirement: Panel functionality moves to commands
All functionality previously provided by panels SHALL be accessible via commands that produce output in the conversation stream.

#### Scenario: Skills inspection via command
- **WHEN** the user types `/skills`
- **THEN** the TUI displays a list of registered skills in the conversation stream

#### Scenario: Memory inspection via command
- **WHEN** the user types `/memory`
- **THEN** the TUI displays memory context information in the conversation stream

#### Scenario: Config inspection via command
- **WHEN** the user types `/config`
- **THEN** the TUI displays current configuration in the conversation stream
