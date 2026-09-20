# reasoning-only-auto-continue Specification

## ADDED Requirements

### Requirement: Reasoning-only completion SHALL dispatch a silent continue
The system SHALL detect when a turn ends with reasoning present but no message content, and dispatch a silent "Please continue." prompt so the model produces an actual response.

#### Scenario: Reasoning-only turn triggers continue
- **WHEN** a turn finalizes with committed reasoning present and no committed message content
- **THEN** the system dispatches a silent "Please continue." prompt

#### Scenario: Reasoning-only continue is not rendered in the TUI
- **WHEN** a silent continue prompt is dispatched
- **THEN** the prompt is added to session state but not rendered as a user message in the TUI

#### Scenario: Continued response renders in a fresh bubble
- **WHEN** the silent continue produces a response
- **THEN** the response streams into a new assistant bubble rather than appending to the existing reasoning bubble

### Requirement: Reasoning-only continue SHALL be bounded by the auto-continue limit
The system SHALL cap the number of silent continue attempts using the `agent.autoContinueLimit` config value (default 1000).

#### Scenario: Limit reached stops the loop
- **WHEN** the number of silent continue attempts reaches `agent.autoContinueLimit`
- **THEN** the system stops auto-continuing and emits the "Model appears stuck" message

### Requirement: Reasoning-only detection SHALL require reasoning present
The system SHALL only dispatch a silent continue when reasoning content is present.

#### Scenario: No reasoning, no message does not trigger continue
- **WHEN** a turn finalizes with no reasoning and no message content
- **THEN** the system does not dispatch a silent continue

#### Scenario: Message present does not trigger continue
- **WHEN** a turn finalizes with message content present
- **THEN** the system does not dispatch a silent continue
