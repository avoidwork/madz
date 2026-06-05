## REMOVED Requirements

### Requirement: Conversation panel uses ScrollView for rendering messages
**Reason**: Replaced by OpenTUI native ScrollBox
**Migration**: The `ScrollView` from `ink-scroll-view` is replaced by the built-in `<scrollbox>` component with `stickyScroll={true}` and `stickyStart="bottom"`

### Requirement: Conversation panel handles keyboard scroll input
**Reason**: ScrollBox handles keyboard navigation natively
**Migration**: Arrow keys, page-up, page-down, home, and end are handled automatically by ScrollBox without custom `useInput` scroll translation

### Requirement: Conversation panel handles terminal resize
**Reason**: OpenTUI's Yoga layout engine handles resize automatically
**Migration**: The manual `stdout.on("resize")` listener and `scrollRef.remeasure()` calls are removed

### Requirement: app.js no longer manages scroll state
**Reason**: Unchanged — was already satisfied in prior refactoring
**Migration**: No behavior change required

### Requirement: messages.js no longer exports scroll virtualization functions
**Reason**: Unchanged — spec already satisfied from prior refactoring
**Migration**: No behavior change required

## ADDED Requirements

### Requirement: Conversation panel uses ScrollBox with sticky scroll
The ConversationPanel SHALL render messages inside an OpenTUI `<scrollbox>` component configured with `stickyScroll={true}` and `stickyStart="bottom"`.

#### Scenario: ScrollBox wraps message list
- **WHEN** the ConversationPanel renders messages
- **THEN** a `<scrollbox>` component from `@opentui/core` is the container for all message elements

#### Scenario: Messages receive unique keys
- **WHEN** the scrollbox renders its children
- **THEN** each message element has a unique `key` prop

#### Scenario: Auto-scroll to new messages
- **WHEN** a new message is added to the conversation
- **THEN** sticky scroll keeps the view at the bottom automatically

#### Scenario: User can scroll up to read history
- **WHEN** the user scrolls up in the scrollbox
- **THEN** sticky scroll pauses (user-controlled scroll is not overridden) until the user scrolls back to the bottom
