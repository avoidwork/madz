## ADDED Requirements

### Requirement: Ctrl+E opens external editor
The system SHALL spawn the external editor configured by `$EDITOR` when the user presses Ctrl+E in the input bar, writing the current input text to a temporary file for editing.

#### Scenario: Ctrl+E opens the editor with current input
- **WHEN** the user presses Ctrl+E in the input bar
- **THEN** the system writes the current input text to a temporary file and spawns `$EDITOR` with that file

#### Scenario: $EDITOR unset falls back to vi
- **WHEN** `$EDITOR` is not set in the environment
- **THEN** the system falls back to `vi` as the editor

### Requirement: Editor save submits edited content
The system SHALL read the temporary file back after the editor exits successfully (exit code 0) and submit the edited content as the input.

#### Scenario: Saving in the editor submits the content
- **WHEN** the editor exits with code 0 after the user saves
- **THEN** the system reads the temporary file, cleans it up, and submits the edited content

### Requirement: Editor non-zero exit does not submit
The system SHALL not submit the input when the editor exits with a non-zero code, and SHALL show a status message instead.

#### Scenario: Non-zero exit does not submit
- **WHEN** the editor exits with a non-zero code
- **THEN** the system cleans up the temporary file and shows a status message without submitting

### Requirement: Editor spawn does not block the TUI
The system SHALL spawn the editor asynchronously using `child_process.spawn`, not `spawnSync`, so the TUI event loop is not blocked.

#### Scenario: Editor spawn is asynchronous
- **WHEN** the editor is spawned
- **THEN** the spawn is asynchronous and the TUI remains responsive
