## MODIFIED Requirements

### Requirement: Mouse-wheel scrolling drives the ScrollView scroll API
The conversation panel SHALL support mouse-wheel scrolling by parsing SGR mouse sequences and driving the custom `ScrollView`'s `scrollBy` API. Wheel-up scrolls up by `mouseScrollLines` lines; wheel-down scrolls down by `mouseScrollLines` lines. The `mouseScrollLines` value SHALL default to 1 when not configured.

#### Scenario: Wheel-up scrolls up
- **WHEN** the user scrolls the mouse wheel up while in the conversation view
- **THEN** the conversation area's `scrollBy(-N)` is invoked, where N is the configured `mouseScrollLines` value (default 1)

#### Scenario: Wheel-down scrolls down
- **WHEN** the user scrolls the mouse wheel down while in the conversation view
- **THEN** the conversation area's `scrollBy(N)` is invoked, where N is the configured `mouseScrollLines` value (default 1)

#### Scenario: Mouse scroll step is configurable
- **WHEN** `tui.mouseScrollLines` is set to a positive integer N
- **THEN** each wheel event scrolls by N lines instead of one line
