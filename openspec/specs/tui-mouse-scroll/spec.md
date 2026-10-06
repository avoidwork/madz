# tui-mouse-scroll Specification

## Purpose
TBD - created by archiving change mouse-wheel-scroll-conversation-panel. Update Purpose after archive.
## Requirements
### Requirement: Mouse-wheel scrolling drives the ScrollView scroll API
The conversation panel SHALL support mouse-wheel scrolling by parsing SGR mouse sequences and driving the custom `ScrollView`'s `scrollBy` API. Wheel-up scrolls up by one line; wheel-down scrolls down by one line.

#### Scenario: Wheel-up scrolls up
- **WHEN** the user scrolls the mouse wheel up while in the conversation view
- **THEN** the conversation area's `scrollBy(-1)` is invoked

#### Scenario: Wheel-down scrolls down
- **WHEN** the user scrolls the mouse wheel down while in the conversation view
- **THEN** the conversation area's `scrollBy(1)` is invoked

### Requirement: Mouse reporting is enabled and disabled around the hook lifecycle
The `useMouseScroll` hook SHALL enable terminal mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`) on mount and disable it (`\x1b[?1000l` / `\x1b[?1006l`) on unmount. It SHALL remove its stdin listener on unmount.

#### Scenario: Mouse reporting enabled on mount
- **WHEN** the `useMouseScroll` hook mounts
- **THEN** the terminal mouse reporting sequences are written to stdout

#### Scenario: Mouse reporting disabled on unmount
- **WHEN** the `useMouseScroll` hook unmounts
- **THEN** the terminal mouse reporting disable sequences are written to stdout and the stdin listener is removed

### Requirement: Mouse events are only handled in the conversation view
The mouse-scroll hook SHALL only invoke scroll actions when the conversation view is active and the file picker is closed, matching the existing keyboard scroll behavior.

#### Scenario: Mouse events ignored outside conversation view
- **WHEN** a mouse wheel event arrives while not in the conversation view
- **THEN** no scroll action is invoked

#### Scenario: Mouse events ignored when file picker is open
- **WHEN** a mouse wheel event arrives while the file picker is open
- **THEN** no scroll action is invoked

### Requirement: Mouse scrolling integrates with scroll-up suppression
When the user scrolls up via mouse, the `isUserScrolledUpRef` in `messageList.js` SHALL be set to `true` so auto-scroll on new messages is suppressed until the user returns to the bottom.

#### Scenario: Scroll-up suppresses auto-scroll
- **WHEN** the user scrolls up via mouse
- **THEN** `isUserScrolledUpRef` is set to `true`, suppressing auto-scroll on new messages

#### Scenario: Returning to bottom resumes auto-scroll
- **WHEN** the user scrolls back to the bottom via mouse
- **THEN** `isUserScrolledUpRef` is set to `false`, resuming auto-scroll on new messages

