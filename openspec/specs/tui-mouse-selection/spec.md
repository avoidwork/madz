# tui-mouse-selection Specification

## Purpose
TBD - created by archiving change tui-mouse-selection-clipboard. Update Purpose after archive.
## Requirements
### Requirement: Character-level mouse selection copies to clipboard
The conversation panel SHALL support character-level mouse selection that copies the selected text to the system clipboard. Selection works wherever mouse-wheel scrolling is active (the conversation view with the file picker closed).

#### Scenario: Drag selection copies text to clipboard
- **WHEN** the user presses the left mouse button, drags across text in the conversation view, and releases
- **THEN** the selected text is written to the system clipboard via `clipboardy`

#### Scenario: Selection is suppressed outside the conversation view
- **WHEN** a mouse drag event arrives while not in the conversation view
- **THEN** no selection is performed

#### Scenario: Selection is suppressed when the file picker is open
- **WHEN** a mouse drag event arrives while the file picker is open
- **THEN** no selection is performed

### Requirement: Mouse drag events are tracked via button-event tracking
The `useMouseScroll` hook SHALL enable button-event tracking (`\x1b[?1002h`) on mount and disable it (`\x1b[?1002l`) on unmount, in addition to the existing mouse reporting sequences. Left-button drag (button code 0) is tracked distinctly from wheel events (button codes 64/65).

#### Scenario: Button-event tracking enabled on mount
- **WHEN** the `useMouseScroll` hook mounts
- **THEN** the `\x1b[?1002h` sequence is written to stdout

#### Scenario: Button-event tracking disabled on unmount
- **WHEN** the `useMouseScroll` hook unmounts
- **THEN** the `\x1b[?1002l` sequence is written to stdout

#### Scenario: Left-button press starts a selection
- **WHEN** a left-button press (button 0) sequence is parsed
- **THEN** the selection start `(x, y)` is recorded

#### Scenario: Drag move updates the selection end
- **WHEN** a move event is parsed while a button is held
- **THEN** the selection end `(x, y)` is updated

#### Scenario: Release finalizes the selection
- **WHEN** a release sequence is parsed
- **THEN** the selection is finalized and the `onSelect` callback is invoked with the start/end coordinates

### Requirement: Coordinates map to a character range in the rendered conversation
The system SHALL map `(x, y)` coordinates to a character range in the rendered conversation, using the terminal width, the scroll offset, and each message's plain text plus wrapped-line structure.

#### Scenario: Selection maps to a character range
- **WHEN** a start/end `(x, y)` pair is provided with a known rendered layout
- **THEN** the corresponding character range is resolved

#### Scenario: Scroll offset is added to the mouse y coordinate
- **WHEN** the conversation is scrolled and a mouse `y` coordinate is provided
- **THEN** the scroll offset from `getScrollOffset()` is added to the mouse `y` coordinate before mapping

#### Scenario: Selection spanning multiple wrapped lines maps correctly
- **WHEN** a selection spans multiple wrapped lines
- **THEN** the character range spans the wrapped lines correctly

#### Scenario: Selection starting or ending outside the message area is clamped
- **WHEN** a selection starts or ends outside the message area
- **THEN** the character range is clamped to the rendered layout bounds

#### Scenario: Empty selection produces no copy
- **WHEN** the selection start and end resolve to the same character
- **THEN** no text is copied to the clipboard

### Requirement: Selected region is highlighted
The system SHALL render the selected character range with inverse video or a background style so the user sees what is being grabbed.

#### Scenario: Selected region is highlighted during drag
- **WHEN** a drag selection is in progress
- **THEN** the selected character range is rendered with a highlight style

#### Scenario: Highlight clears on release
- **WHEN** the drag selection is released
- **THEN** the highlight is cleared

