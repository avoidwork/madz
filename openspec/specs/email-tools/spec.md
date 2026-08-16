# email-tools Specification

## Purpose
TBD - created by archiving change email-integration. Update Purpose after archive.
## Requirements
### Requirement: Email read tool fetches messages with filtering
The system SHALL provide an `email.read` tool that fetches messages from configurable folders (inbox, sent, drafts, custom) with filtering by sender, date range, subject keyword, and keyword body search.

#### Scenario: Fetch inbox messages
- **WHEN** user calls email.read with folder="inbox" and limit=10
- **THEN** system returns up to 10 most recent messages with id, subject, from, date, snippet, and isRead fields

#### Scenario: Filter by sender
- **WHEN** user calls email.read with folder="inbox" and sender="alice@example.com"
- **THEN** system returns only messages where the sender address matches alice@example.com

#### Scenario: Filter by date range
- **WHEN** user calls email.read with folder="inbox" and dateAfter="2024-01-01" and dateBefore="2024-06-01"
- **THEN** system returns only messages received within the specified date range

#### Scenario: Filter by subject keyword
- **WHEN** user calls email.read with folder="inbox" and subject="invoice"
- **THEN** system returns messages whose subject contains the keyword "invoice" (case-insensitive)

#### Scenario: Fetch sent messages
- **WHEN** user calls email.read with folder="sent" and limit=5
- **THEN** system returns up to 5 most recent sent messages

#### Scenario: Fetch draft messages
- **WHEN** user calls email.read with folder="drafts"
- **THEN** system returns all saved draft messages with id, subject, to, bodyPreview, and lastModified fields

#### Scenario: No matching messages
- **WHEN** user calls email.read with folder="inbox" and subject="zzzznonexistent"
- **THEN** system returns an empty array

### Requirement: Email send tool composes and sends messages
The system SHALL provide an `email.send` tool that composes and sends emails with text or HTML body, optional attachments, and CC/BCC recipients.

#### Scenario: Send plain text email
- **WHEN** user calls email.send with to="recipient@example.com", subject="Hello", body="Hello world"
- **THEN** system sends the email successfully and returns the sent message id

#### Scenario: Send HTML email
- **WHEN** user calls email.send with to="recipient@example.com", subject="Report", body="<h1>Report</h1><p>Data</p>", html=true
- **THEN** system sends the email with HTML content and returns the sent message id

#### Scenario: Send with CC recipients
- **WHEN** user calls email.send with to="recipient@example.com", cc="manager@example.com", subject="FYI", body="FYI"
- **THEN** system sends the email with both the primary recipient and CC recipient

#### Scenario: Send with BCC recipients
- **WHEN** user calls email.send with to="recipient@example.com", bcc="hidden@example.com", subject="Secret", body="Hidden"
- **THEN** system sends the email with the BCC recipient not visible to the primary recipient

#### Scenario: Send with attachment
- **WHEN** user calls email.send with to="recipient@example.com", subject="Report", body="See attached", attachments=["/path/to/report.pdf"]
- **THEN** system attaches the file and sends the email, returning the sent message id

#### Scenario: Send with multiple attachments
- **WHEN** user calls email.send with to="recipient@example.com", subject="Files", body="See attached", attachments=["/path/to/a.pdf", "/path/to/b.pdf"]
- **THEN** system attaches both files and sends the email

#### Scenario: Send with invalid attachment path
- **WHEN** user calls email.send with to="recipient@example.com", subject="Bad", body="No file", attachments=["/nonexistent/file.txt"]
- **THEN** system returns an error indicating the attachment file was not found

### Requirement: Email draft management
The system SHALL provide draft management tools for saving, listing, updating, and deleting email drafts.

#### Scenario: Save a draft
- **WHEN** user calls email.draft.save with to="recipient@example.com", subject="Work in Progress", body="Draft content"
- **THEN** system saves the draft and returns the draft id

#### Scenario: List all drafts
- **WHEN** user calls email.draft.list
- **THEN** system returns all saved drafts with id, subject, to, bodyPreview, and lastModified fields

#### Scenario: Update a draft
- **WHEN** user calls email.draft.update with draftId="draft-123", subject="Updated Subject", body="Updated content"
- **THEN** system updates the draft and returns the updated draft with a new lastModified timestamp

#### Scenario: Delete a draft
- **WHEN** user calls email.draft.delete with draftId="draft-123"
- **THEN** system removes the draft and returns success

#### Scenario: Delete non-existent draft
- **WHEN** user calls email.draft.delete with draftId="draft-999"
- **THEN** system returns an error indicating the draft was not found

### Requirement: Email organize tool manages message state
The system SHALL provide an `email.organize` tool for labeling, archiving, marking read/unread, and searching messages.

#### Scenario: Mark messages as read
- **WHEN** user calls email.organize with action="markRead" and messageIds=["msg-1", "msg-2"]
- **THEN** system marks the specified messages as read

#### Scenario: Mark messages as unread
- **WHEN** user calls email.organize with action="markUnread" and messageIds=["msg-3"]
- **THEN** system marks the specified messages as unread

#### Scenario: Archive messages
- **WHEN** user calls email.organize with action="archive" and messageIds=["msg-4", "msg-5"]
- **THEN** system archives the specified messages, removing them from the inbox

#### Scenario: Add label to message
- **WHEN** user calls email.organize with action="addLabel", messageIds=["msg-6"], label="important"
- **THEN** system adds the "important" label to the specified messages

#### Scenario: Remove label from message
- **WHEN** user calls email.organize with action="removeLabel", messageIds=["msg-6"], label="important"
- **THEN** system removes the "important" label from the specified messages

#### Scenario: Search messages
- **WHEN** user calls email.organize with action="search", query="quarterly report", folder="all"
- **THEN** system returns messages matching the search query across the specified folder

#### Scenario: Search with no results
- **WHEN** user calls email.organize with action="search", query="zzzznonexistent", folder="inbox"
- **THEN** system returns an empty array

