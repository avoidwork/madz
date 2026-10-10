## ADDED Requirements

### Requirement: Ctrl+F toggles in-conversation search mode
The TUI SHALL bind Ctrl+F to toggle in-conversation search mode in the conversation view. When search mode is active, the user can type a query to filter/search messages.

#### Scenario: Ctrl+F activates search mode
- **WHEN** the user presses Ctrl+F in the conversation view
- **THEN** search mode is activated and the search input is focused

#### Scenario: Escape exits search mode
- **WHEN** the user presses Escape while search mode is active
- **THEN** search mode is deactivated and input focus is restored

### Requirement: Search matches and highlights messages
The TUI SHALL search message text for the query and highlight all matches. The search SHALL be case-insensitive and treat the query as a literal string (no regex injection).

#### Scenario: Search highlights matching messages
- **WHEN** a search query matches message text
- **THEN** the matching messages are highlighted

#### Scenario: Search query with special characters is treated literally
- **WHEN** the search query contains regex special characters (e.g. `.`, `*`, `+`, `?`)
- **THEN** the query is treated as a literal string and no regex injection occurs

#### Scenario: No matches found is handled gracefully
- **WHEN** a search query has no matches
- **THEN** the conversation shows a neutral state without crashing

### Requirement: Jump-to-next advances through search results
The TUI SHALL provide jump-to-next (and jump-to-prev) that advances through search results and scrolls to the matched message.

#### Scenario: Jump-to-next scrolls to the next match
- **WHEN** the user triggers jump-to-next with search results present
- **THEN** the scroll view scrolls to the next matched message

#### Scenario: Jump-to-prev scrolls to the previous match
- **WHEN** the user triggers jump-to-prev with search results present
- **THEN** the scroll view scrolls to the previous matched message

#### Scenario: Jump-to-next wraps around at the end
- **WHEN** the user triggers jump-to-next past the last match
- **THEN** the search index wraps to the first match
