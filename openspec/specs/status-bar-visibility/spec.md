# status-bar-visibility Specification

## Purpose
TBD - created by archiving change configurable-status-bar-visibility. Update Purpose after archive.
## Requirements
### Requirement: Status bar elements are individually configurable
The system SHALL provide a `tui.statusBar` configuration block with per-item booleans (`model`, `skills`, `messages`, `context`, `tokens`, `quote`, `version`) that control which status bar elements are visible. Each element SHALL render only when its boolean is `true` AND its data is present. The status bar SHALL always render — there is no master toggle. The streaming indicator (spinner) SHALL always render and SHALL NOT be configurable.

#### Scenario: All booleans default to true
- **WHEN** `tui.statusBar` is absent or set to `{}`
- **THEN** all status bar elements render according to their data presence, matching today's behavior

#### Scenario: skills element is hidden
- **WHEN** `tui.statusBar.skills` is `false`
- **THEN** the skills element is omitted from the status bar

#### Scenario: model element is hidden
- **WHEN** `tui.statusBar.model` is `false`
- **THEN** the model element is omitted from the status bar

#### Scenario: messages element is hidden
- **WHEN** `tui.statusBar.messages` is `false`
- **THEN** the messages element is omitted from the status bar

#### Scenario: context element is hidden
- **WHEN** `tui.statusBar.context` is `false`
- **THEN** the context element is omitted from the status bar

#### Scenario: tokens element is hidden
- **WHEN** `tui.statusBar.tokens` is `false`
- **THEN** the tokens element is omitted from the status bar

#### Scenario: quote element is hidden
- **WHEN** `tui.statusBar.quote` is `false`
- **THEN** the quote element is omitted from the status bar

#### Scenario: version element is hidden
- **WHEN** `tui.statusBar.version` is `false`
- **THEN** the version element is omitted from the status bar

#### Scenario: streaming indicator always renders
- **WHEN** the status bar is streaming
- **THEN** the streaming indicator (spinner) is always rendered regardless of any `tui.statusBar` boolean

#### Scenario: missing statusBar config does not crash
- **WHEN** no `statusBar` prop is passed to the StatusBar component
- **THEN** the component renders without error, defaulting all booleans to `true`

