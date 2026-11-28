# Spec Delta

## MODIFIED Requirements

### Requirement: Mouse events are only handled in the conversation view

The mouse-scroll hook SHALL only invoke scroll actions when the conversation view is active and the file picker is closed, or when the subagents panel is the active view, matching the existing keyboard scroll behavior. When the subagents panel is active, the wheel scroll SHALL route to the subagents panel's scroll API.

#### Scenario: Mouse events ignored outside conversation view

- **WHEN** a mouse wheel event arrives while not in the conversation view
- **THEN** no scroll action is invoked

#### Scenario: Mouse events ignored when file picker is open

- **WHEN** a mouse wheel event arrives while the file picker is open
- **THEN** no scroll action is invoked

#### Scenario: Wheel scrolls the subagents panel

- **WHEN** the subagents panel is the active view and the user scrolls the mouse wheel
- **THEN** the subagents panel scrolls by the configured number of lines
