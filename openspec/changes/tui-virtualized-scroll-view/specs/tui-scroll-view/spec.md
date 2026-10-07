## MODIFIED Requirements

### Requirement: MessageList uses ScrollView for rendering messages
The MessageList component SHALL render messages inside the custom `ScrollView` component from `src/tui/scrollView.js` rather than manually slicing a messages array. ConversationPanel delegates all rendering to MessageList and does not directly render messages.

#### Scenario: ScrollView wraps message list
- **WHEN** the UI renders a conversation
- **THEN** the custom `ScrollView` from `src/tui/scrollView.js` is the container inside MessageList, which is rendered by ConversationPanel

#### Scenario: Messages receive unique keys
- **WHEN** the ScrollView renders its children
- **THEN** each message element has a unique `key` prop (derived from message ID)

### Requirement: ScrollView supports real per-item measurement
The ScrollView component SHALL implement real per-item measurement via `useBoxMetrics`, replacing the no-op `remeasureItem`, so a growing bubble can report its height change and update the virtual view's height map.

#### Scenario: remeasureItem measures a specific item
- **WHEN** `remeasureItem(index)` is called on the ScrollView ref
- **THEN** the item at that render index is re-measured via `useBoxMetrics` and its height is updated

#### Scenario: Growing bubble reports height via onHeight
- **WHEN** a bubble grows during streaming
- **THEN** it reports its height change via `onHeight`, updating the height map

#### Scenario: Scroll-to-bottom re-anchors when user is at bottom
- **WHEN** the user is at the bottom and a bubble grows
- **THEN** the view re-anchors to the bottom
