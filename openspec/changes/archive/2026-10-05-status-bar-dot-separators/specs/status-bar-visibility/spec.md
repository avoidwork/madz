## ADDED Requirements

### Requirement: Visible status bar elements render with dot separators
When a status bar element is visible (per the `tui.statusBar` booleans), it SHALL render with a light floating dot (`∙`, U+2219) separator to its left instead of `[ ]` brackets. The model name SHALL be the first element after the streaming indicator and SHALL NOT have a dot. Every visible element after the model name SHALL have a `∙` dot to its left.

#### Scenario: Visible elements use dot separators
- **WHEN** a status bar element is visible
- **THEN** it renders with a `∙` dot separator to its left instead of `[ ]` brackets

#### Scenario: Model name has no dot
- **WHEN** the model element is visible
- **THEN** it renders with no leading dot, and each subsequent visible element renders with a `∙` dot to its left
