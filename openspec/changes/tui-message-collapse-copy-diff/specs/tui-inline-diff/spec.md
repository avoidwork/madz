## ADDED Requirements

### Requirement: Inline diff view renders file changes
The system SHALL render file edits as green/red diff lines in a collapsible block within the TUI message stream. Added lines SHALL be rendered green, removed lines SHALL be rendered red, and unchanged context lines SHALL be rendered in the default color. The diff block SHALL be collapsible and SHALL default to collapsed.

#### Scenario: Inline diff renders added lines in green
- **WHEN** a diff string contains added lines (prefixed with `+`)
- **THEN** the added lines are rendered in green

#### Scenario: Inline diff renders removed lines in red
- **WHEN** a diff string contains removed lines (prefixed with `-`)
- **THEN** the removed lines are rendered in red

#### Scenario: Inline diff renders unchanged context lines in default color
- **WHEN** a diff string contains unchanged context lines (prefixed with a space)
- **THEN** the context lines are rendered in the default color

#### Scenario: Inline diff renders a collapsible block
- **WHEN** a diff block is present
- **THEN** it renders as a collapsible block that defaults to collapsed

#### Scenario: Inline diff handles empty or malformed input gracefully
- **WHEN** a diff string is empty or contains no recognizable hunks
- **THEN** the renderer degrades gracefully without crashing
