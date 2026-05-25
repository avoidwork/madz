## ADDED Requirements

### Requirement: Conversation panel uses ScrollView for rendering messages
The ConversationPanel SHALL render messages inside a `ScrollView` component from `ink-scroll-view` rather than manually slicing a messages array.

#### Scenario: ScrollView wraps message list
- **WHEN** the ConversationPanel renders messages
- **THEN** a `ScrollView` from `ink-scroll-view` is the container for all message elements

#### Scenario: Messages receive unique keys
- **WHEN** the ScrollView renders its children
- **THEN** each message element has a unique `key` prop (derived from message ID or index)

### Requirement: Conversation panel handles keyboard scroll input
The ConversationPanel SHALL capture keyboard input via Ink's `useInput` and translate arrow keys and page keys into scroll actions on the `ScrollView` ref.

#### Scenario: Up arrow scrolls up by one line
- **WHEN** the user presses the up arrow key in the conversation panel
- **THEN** the ScrollView ref calls `scrollBy(-1)` to scroll up one line

#### Scenario: Down arrow scrolls down by one line
- **WHEN** the user presses the down arrow key in the conversation panel
- **THEN** the ScrollView ref calls `scrollBy(1)` to scroll down one line

#### Scenario: Page up scrolls up by viewport height
- **WHEN** the user presses page-up
- **THEN** the ScrollView ref calls `scrollBy(-N)` where N equals the current viewport height

#### Scenario: Page down scrolls down by viewport height
- **WHEN** the user presses page-down
- **THEN** the ScrollView ref calls `scrollBy(N)` where N equals the current viewport height

### Requirement: Conversation panel handles terminal resize
The ConversationPanel SHALL listen for `resize` events on `stdout` and call `remeasure()` on the ScrollView ref to update measured heights after a terminal dimension change.

#### Scenario: ScrollView is remeasured on terminal resize
- **WHEN** the terminal window is resized while the TUI is active
- **THEN** the ScrollView ref's `remeasure()` method is called

#### Scenario: Resize listener is cleaned up on unmount
- **WHEN** the ConversationPanel unmounts (user switches away from conversation)
- **THEN** the `resize` event listener is removed from `stdout`

### Requirement: app.js no longer manages scroll state
The `app.js` component SHALL NOT maintain `scrollOffset` or `isScrolling` state for the conversation panel. Scroll state is managed entirely within `ConversationPanel` by the `ScrollView` component.

#### Scenario: Scroll state is removed from app.js
- **WHEN** `app.js` is inspected for scroll-related state
- **THEN** no `useState` calls for `scrollOffset` or `isScrolling` exist in the file

#### Scenario: ConversationPanel receives simplified props
- **WHEN** `app.js` renders `ConversationPanel`
- **THEN** only `messages` and `assistantName` are passed as props (no `scrollOffset`, `visibleCount`, `isScrolling`, or `onScroll`)

### Requirement: messages.js no longer exports scroll virtualization functions
The `messages.js` module SHALL NOT export `getVisibleMessages` or `calcVisibleCount` functions. These are replaced by `ink-scroll-view`'s internal virtualization.

#### Scenario: getVisibleMessages is removed from exports
- **WHEN** `messages.js` is imported
- **THEN** the `getVisibleMessages` symbol is not exported

#### Scenario: calcVisibleCount is removed from exports
- **WHEN** `messages.js` is imported
- **THEN** the `calcVisibleCount` symbol is not exported

#### Scenario: Message formatting utilities remain
- **WHEN** `messages.js` is imported
- **THEN** `getRoleLabel`, `isStreamingMessage`, and `formatMessage` remain exported
