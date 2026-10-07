## MODIFIED Requirements

### Requirement: MessageList uses ScrollView for rendering messages
The MessageList component SHALL render messages inside the custom `ScrollView` component from `src/tui/scrollView.js` rather than manually slicing a messages array. ConversationPanel delegates all rendering to MessageList and does not directly render messages. The ScrollView SHALL support windowed/virtualized rendering so only the visible window plus an overscan buffer is mounted.

#### Scenario: ScrollView wraps message list
- **WHEN** the UI renders a conversation
- **THEN** the custom `ScrollView` from `src/tui/scrollView.js` is the container inside MessageList, which is rendered by ConversationPanel

#### Scenario: Messages receive unique keys
- **WHEN** the ScrollView renders its children
- **THEN** each message element has a unique `key` prop (derived from message ID)

#### Scenario: ScrollView renders only the visible window plus overscan
- **WHEN** the conversation has more messages than fit in the viewport plus overscan
- **THEN** the ScrollView mounts only the visible range plus the overscan buffer, with spacer boxes for the off-window regions

## ADDED Requirements

### Requirement: ScrollView performs real per-item measurement
The ScrollView SHALL perform real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`, so a growing bubble reports its height via `onHeight` and the height map updates without a full parent re-render.

#### Scenario: remeasureItem is no longer a no-op
- **WHEN** a mounted bubble grows via pub/sub streaming
- **THEN** `remeasureItem` triggers a real re-measure of that item, updating the height map

#### Scenario: Growing bubble reports height via onHeight
- **WHEN** a mounted bubble's measured height changes
- **THEN** the ScrollView updates the height map and re-anchors the scroll position when the user is at the bottom
