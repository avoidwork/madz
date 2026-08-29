# tui-performance Specification

## Purpose
TBD - created by archiving change optimize-tui-render-performance. Update Purpose after archive.
## Requirements
### Requirement: ConversationPanel memoization
The ConversationPanel component SHALL be wrapped in React.memo to prevent re-renders when its props (messages, assistantName, scrollRef, messageListRef) have not changed. Default shallow comparison is sufficient.

#### Scenario: ConversationPanel does not re-render with stable props
- **WHEN** App re-renders due to inputText change
- **THEN** ConversationPanel does not re-render because its props are unchanged

#### Scenario: ConversationPanel re-renders with changed messages
- **WHEN** messages array reference changes (new messages added)
- **THEN** ConversationPanel re-renders to display the new messages

### Requirement: App memoization with custom comparator
The App component SHALL be wrapped in React.memo with a custom areEqual comparator that ignores frequently-changing props (inputText, statusMessage, chatHistory, historyIndex, inputFocused, showBanner, onboardingResponse) while comparing stable props (config, registry, sessionState, contextSize, isCompacting, etc.).

#### Scenario: App does not re-render on keystroke
- **WHEN** user types in the input field (inputText changes)
- **THEN** App does not re-render because the comparator returns true for stable props

#### Scenario: App re-renders on config change
- **WHEN** config object reference changes
- **THEN** App re-renders because the comparator detects a stable prop change

### Requirement: MarkdownText module-level cache removal
The MarkdownTextInner component SHALL NOT use module-level variables (lastContentRef, lastElementRef) for caching. The React.memo(MarkdownTextInner) wrapper and the LRU cache in parseMarkdown SHALL handle deduplication.

#### Scenario: MarkdownText deduplicates via LRU cache
- **WHEN** parseMarkdown is called with identical content
- **THEN** the LRU cache returns the same parsed string

#### Scenario: MarkdownText skips re-render via React.memo
- **WHEN** MarkdownTextInner receives unchanged content prop
- **THEN** React.memo prevents re-render

#### Scenario: No module-level state leakage
- **WHEN** multiple MarkdownText instances exist
- **THEN** they do not share mutable state (lastContentRef/lastElementRef removed)

