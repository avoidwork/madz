## ADDED Requirements

### Requirement: MessageList supports in-conversation search state
The MessageList SHALL maintain a `searchQuery` state and a `searchIndex` (current match) and expose an imperative API (`setSearchQuery`, `clearSearch`, `searchNext`, `searchPrev`) for search control. The search SHALL reuse `getMessages()` to find matches and compute the scroll target offset.

#### Scenario: setSearchQuery updates the search query
- **WHEN** `setSearchQuery(query)` is called with a non-empty query
- **THEN** the search query is updated and matching messages are computed

#### Scenario: clearSearch resets search state
- **WHEN** `clearSearch()` is called
- **THEN** the search query is cleared and highlighting is removed

#### Scenario: searchNext advances the current match
- **WHEN** `searchNext()` is called with search results present
- **THEN** the search index advances to the next match and the scroll view scrolls to it

#### Scenario: searchPrev moves to the previous match
- **WHEN** `searchPrev()` is called with search results present
- **THEN** the search index moves to the previous match and the scroll view scrolls to it

### Requirement: MessageList highlights search matches
The MessageList SHALL compute local match ranges within each bubble's text and pass them to `MessageBubble` for highlighting when a search query is active. The search SHALL be case-insensitive and treat the query as a literal string.

#### Scenario: Search matches are highlighted in bubbles
- **WHEN** a search query is active and a bubble's text contains a match
- **THEN** the matching text is highlighted in the bubble

#### Scenario: Search query with special characters is treated literally
- **WHEN** the search query contains regex special characters
- **THEN** the query is escaped and treated as a literal string

#### Scenario: No matches found is handled gracefully
- **WHEN** a search query has no matches
- **THEN** the conversation renders without crashing and no highlights are shown
