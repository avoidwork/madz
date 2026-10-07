## ADDED Requirements

### Requirement: VirtualScrollView renders only the visible window plus overscan
The TUI conversation panel SHALL render only the visible window of messages plus an overscan buffer, instead of mounting every message bubble. The mounted set is bounded to roughly `viewport + 2 * overscan`.

#### Scenario: Only the windowed subset mounts
- **WHEN** the conversation has more messages than fit in the viewport plus overscan
- **THEN** only the visible range plus the overscan buffer is mounted, and the rest is represented by spacer boxes

#### Scenario: Mounted set is bounded by viewport plus overscan
- **WHEN** the viewport height is H and overscan is O
- **THEN** the number of mounted message bubbles does not exceed the number that fit in `H + 2 * O` rows

### Requirement: VirtualScrollView maintains a height map and cumulative offsets
The VirtualScrollView SHALL maintain a height map (`id → rows`) per message, using measured heights for mounted bubbles and estimated heights for off-window ones, and compute cumulative offsets to determine the visible range.

#### Scenario: Height map uses measured heights for mounted bubbles
- **WHEN** a bubble is mounted and measured via `useBoxMetrics`
- **THEN** its height in the height map is the measured height

#### Scenario: Height map uses estimated heights for off-window bubbles
- **WHEN** a bubble is not mounted (off-window)
- **THEN** its height in the height map is the estimated height from `estimateMessageHeight`

#### Scenario: Cumulative offsets determine the visible range
- **WHEN** the scroll offset and viewport height are known
- **THEN** the visible range is computed from the cumulative offsets of the height map

### Requirement: VirtualScrollView uses spacer boxes for off-window regions
The VirtualScrollView SHALL use spacer boxes (top/bottom) sized from estimates to preserve the scroll position in estimated coordinate space.

#### Scenario: Top spacer preserves scroll position
- **WHEN** the visible window starts after the first message
- **THEN** a top spacer box of the estimated height of the preceding messages is rendered

#### Scenario: Bottom spacer preserves scroll position
- **WHEN** the visible window ends before the last message
- **THEN** a bottom spacer box of the estimated height of the following messages is rendered

### Requirement: VirtualScrollView performs real per-item measurement
The VirtualScrollView SHALL perform real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`, and correct the height map lazily as items scroll into view.

#### Scenario: Growing bubble reports height via onHeight
- **WHEN** a mounted bubble grows via pub/sub streaming
- **THEN** it reports its new height via `onHeight`, updating the height map

#### Scenario: Height map corrects lazily as items scroll into view
- **WHEN** an off-window item scrolls into view
- **THEN** its estimated height is replaced by the measured height

### Requirement: VirtualScrollView starts bottom-anchored on session restore
The VirtualScrollView SHALL start bottom-anchored on session restore so a huge history never mounts fully.

#### Scenario: Session restore anchors to bottom
- **WHEN** a conversation is restored from session state
- **THEN** the scroll position is anchored to the bottom and only the bottom window plus overscan is mounted
