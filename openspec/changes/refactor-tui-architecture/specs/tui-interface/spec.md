## REMOVED Requirements

### Requirement: Keyboard Navigation
**Reason**: The TUI blueprint explicitly states "No panels, no tabs, no switching." The panel system contradicts the core philosophy of a single scrollable output area with one input line. Skills and memory are accessed via commands (`/skills`, `/memory`) that produce output in the conversation stream.
**Migration**: Use `/skills` and `/memory` commands to inspect skills and memory. These produce output in the conversation stream rather than separate UI panels.

## ADDED Requirements

### Requirement: Command-Based Panel Replacement
The system SHALL provide `/skills` and `/memory` commands that display skills and memory information in the conversation stream, replacing the previous panel-based navigation.

#### Scenario: User lists skills via command
- **WHEN** user types `/skills` in the input panel
- **THEN** the system displays registered skills in the conversation stream

#### Scenario: User views memory via command
- **WHEN** user types `/memory` in the input panel
- **THEN** the system displays memory information in the conversation stream
