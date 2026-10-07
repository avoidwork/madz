## ADDED Requirements

### Requirement: Windowed rendering of the message list
The TUI conversation panel SHALL render only the visible window of messages plus an overscan buffer, instead of mounting every message bubble. The mounted set is bounded to roughly `viewport + 2 * overscan`.

#### Scenario: Only the visible range plus overscan mounts
- **WHEN** a conversation has more messages than fit in the viewport
- **THEN** only the visible range plus the overscan buffer on each side is mounted

#### Scenario: All messages remain accessible via scroll
- **WHEN** a user scrolls up or down in the message list
- **THEN** all historical messages are accessible via the ScrollView, even those not currently mounted

#### Scenario: Overscan handles short messages
- **WHEN** messages are short (1-2 rows) and do not fill the viewport
- **THEN** the mounted set is bounded to roughly `viewport + 2 * overscan`

### Requirement: Per-message height map
The virtual scroll view SHALL maintain a height map (`id → rows`) per message, using measured heights from `useBoxMetrics` for mounted bubbles and estimated heights for off-window ones.

#### Scenario: Height map tracks measured heights
- **WHEN** a bubble is mounted and measured via `useBoxMetrics`
- **THEN** its height is recorded in the height map

#### Scenario: Off-window bubbles use estimated heights
- **WHEN** a bubble is not mounted
- **THEN** its height is estimated via `estimateMessageHeight`

### Requirement: Cumulative offsets and spacer boxes
The virtual scroll view SHALL compute cumulative offsets from the height map and use spacer boxes (top/bottom) sized from estimates to preserve the scroll position in estimated coordinate space.

#### Scenario: Spacer boxes preserve scroll position
- **WHEN** the visible window is rendered
- **THEN** top and bottom spacer boxes are sized from the estimated heights of off-window regions

#### Scenario: Cumulative offsets are computed from the height map
- **WHEN** the visible range is computed
- **THEN** cumulative offsets are derived from the height map

### Requirement: Real per-item measurement
The virtual scroll view SHALL implement real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`.

#### Scenario: Growing bubble reports height via onHeight
- **WHEN** a bubble grows during streaming
- **THEN** it reports its height change via `onHeight`, updating the height map

#### Scenario: Scroll-to-bottom re-anchors when user is at bottom
- **WHEN** the user is at the bottom and a bubble grows
- **THEN** the view re-anchors to the bottom
