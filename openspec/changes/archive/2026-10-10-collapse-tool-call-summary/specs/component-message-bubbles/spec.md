## ADDED Requirements

### Requirement: MessageBubble renders collapsed completed tool calls summary

The MessageBubble component SHALL render a summary of completed tool calls as a collapsed count map, so repeated calls to the same tool display as `name ×count` rather than a repeated list. The summary SHALL hide the `×1` suffix for tools called once and SHALL preserve insertion order (first-call order). The summary SHALL be rendered as `⚡ N tool calls: <name> ×<count>, <name>` where N is the total number of tool calls.

#### Scenario: MessageBubble collapses repeated tool calls

- **WHEN** a MessageBubble's completedToolCalls is a count map `{ read_file: 10, searchCode: 1 }`
- **THEN** it renders `⚡ 11 tool calls: read_file ×10, searchCode`

#### Scenario: MessageBubble hides the count for single calls

- **WHEN** a MessageBubble's completedToolCalls is `{ searchCode: 1 }`
- **THEN** it renders `⚡ 1 tool call: searchCode` without a `×1` suffix

#### Scenario: MessageBubble accepts a legacy array of tool calls

- **WHEN** a MessageBubble's completedToolCalls is a legacy array `["read_file", "read_file", "searchCode"]`
- **THEN** it normalizes the array to a count map and renders `⚡ 3 tool calls: read_file ×2, searchCode`

#### Scenario: MessageBubble renders no summary when there are no completed calls

- **WHEN** a MessageBubble's completedToolCalls is empty or absent
- **THEN** it renders no completed tool calls summary row

### Requirement: MessageList normalizes completed tool calls on session restore

The MessageList component SHALL normalize legacy array-shaped `completedToolCalls` to a count map when restoring messages via `setMessages`, so old session transcripts render correctly with the collapsed summary format.

#### Scenario: setMessages normalizes array-shaped completed tool calls

- **WHEN** `setMessages` is called with a message whose `completedToolCalls` is a legacy array `["read_file", "read_file"]`
- **THEN** the stored message's `completedToolCalls` is normalized to `{ read_file: 2 }`

#### Scenario: setMessages preserves an existing count map

- **WHEN** `setMessages` is called with a message whose `completedToolCalls` is already a count map `{ read_file: 2 }`
- **THEN** the stored message's `completedToolCalls` is unchanged
