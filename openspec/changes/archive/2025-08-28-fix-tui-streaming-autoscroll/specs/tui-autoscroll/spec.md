# tui-autoscroll Specification

## Purpose
Define the behavior for automatic scrolling during streaming responses and manual scroll-up detection.

## Requirements

### Requirement: MessageList SHALL expose scrollToBottom() on its imperative API
The MessageList imperative API SHALL include a `scrollToBottom()` method that calls `scrollRef.current.scrollToBottom()` on the underlying ScrollView.

#### Scenario: scrollToBottom exists on imperative API
- **WHEN** `messageListRef.current.scrollToBottom()` is called
- **THEN** the ScrollView's `scrollToBottom()` method is invoked

#### Scenario: scrollToBottom is safe when scrollRef is null
- **WHEN** `scrollToBottom()` is called and `scrollRef.current` is null
- **THEN** the method returns without error

### Requirement: MessageBubble SHALL receive scroll imperative via context
The MessageBubble component SHALL consume a ScrollContext that provides `scrollToBottom` from MessageList.

#### Scenario: ScrollContext provides scrollToBottom
- **WHEN** MessageBubble consumes ScrollContext
- **THEN** it receives a `scrollToBottom` function from the context value

#### Scenario: ScrollContext has default no-op
- **WHEN** ScrollContext is consumed outside MessageList
- **THEN** `scrollToBottom` is a no-op function

### Requirement: MessageBubble SHALL call scrollToBottom when streaming content grows
When a MessageBubble receives a pub/sub update with content that is longer than its previous content, it SHALL call `scrollToBottom()` via the ScrollContext.

#### Scenario: Streaming content growth triggers scroll
- **WHEN** a streaming MessageBubble receives an update with `content.length > previousContent.length`
- **THEN** `scrollToBottom()` is called via ScrollContext

#### Scenario: Non-streaming content update does not trigger scroll
- **WHEN** a non-streaming MessageBubble receives an update
- **THEN** `scrollToBottom()` is NOT called

#### Scenario: Same-length content update does not trigger scroll
- **WHEN** a streaming MessageBubble receives an update with identical content length
- **THEN** `scrollToBottom()` is NOT called

### Requirement: Manual scroll-up detection SHALL suppress auto-scroll
MessageList SHALL track whether the user has manually scrolled away from the bottom. When the user is scrolled up, auto-scroll from streaming content growth SHALL be suppressed until the user returns to bottom or streaming completes.

#### Scenario: Auto-scroll suppressed when scrolled up
- **WHEN** `scrollOffset > 0` and streaming content grows
- **THEN** `scrollToBottom()` is NOT called

#### Scenario: Auto-scroll resumes at bottom
- **WHEN** `scrollOffset === 0` and streaming content grows
- **THEN** `scrollToBottom()` IS called

#### Scenario: Auto-scroll resumes after streaming ends
- **WHEN** streaming completes and user is at bottom
- **THEN** subsequent content growth triggers auto-scroll
