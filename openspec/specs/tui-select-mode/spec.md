# tui-select-mode Specification

## Purpose
TBD - created by archiving change tui-select-mode-tab-toggle. Update Purpose after archive.

## Requirements

### Requirement: Mouse mode is the default
The TUI SHALL start with mouse reporting enabled and the input live, so typing, wheel scrolling, click-to-expand and link clicks work together.

#### Scenario: Startup
- **WHEN** the conversation view is shown
- **THEN** mouse reporting is on and the border is not cyan

### Requirement: Tab toggles select mode
Tab SHALL toggle an opt-in select mode in which mouse reporting is off (native terminal drag-select and copy), the input border is cyan, and link clicks are ignored. Ctrl+F search and any printable key SHALL exit select mode.

#### Scenario: Toggle
- **WHEN** Tab is pressed twice
- **THEN** select mode is entered then left, and mouse reporting is off then on

### Requirement: Printable key exits select mode without loss
In select mode a printable key SHALL exit select mode and be delivered to the input exactly once, unchanged. Control chords, navigation keys and leftover mouse sequences SHALL NOT be inserted.

#### Scenario: Typing in select mode
- **WHEN** select mode is active and "a" is typed
- **THEN** select mode ends and the input gains "a" once

### Requirement: Per-mode key routing
In default mode Up/Down SHALL browse input history and PageUp/PageDown SHALL scroll the conversation. In select mode Up/Down/PageUp/PageDown SHALL all scroll the conversation.

#### Scenario: Up arrow
- **WHEN** Up is pressed in default mode / select mode
- **THEN** history is browsed / the conversation scrolls up one line

### Requirement: Input remains visible in select mode
The input SHALL stay visible in select mode (unfocused) so the user can see where typed keys will land; it is hidden only while a picker or search input is open.

#### Scenario: Select mode display
- **WHEN** select mode is active with no picker or search open
- **THEN** the input is rendered
