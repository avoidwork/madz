## ADDED Requirements

### Requirement: Canonical Profile Files Are Valid Context
The system SHALL treat the three canonical profile files created by the `customize` tool (`memory/context/user-profile.md`, `memory/context/preferences.md`, `memory/context/personal.md`) identically to user-created context files. All three are read and prepended to the LLM prompt context in alphabetical order, just like any other `.md` files in `memory/context/`.

#### Scenario: System reads canonical profile files as context
- **WHEN** the user sends a message to the LLM after running `customize`
- **THEN** the system loads `memory/context/personal.md`, `memory/context/preferences.md`, and `memory/context/user-profile.md` (alphabetical order) alongside any other context files

#### Scenario: Canonical files persist with other context files
- **WHEN** the memory retention policy purges old files in `memory/context/`
- **THEN** canonical profile files follow the same retention rules as user-created context files (no special exception)
