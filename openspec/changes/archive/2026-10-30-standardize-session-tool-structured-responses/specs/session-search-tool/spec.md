# Spec Delta

## Purpose

Defines the structured response contract for the `searchSession` tool, which retrieves, searches, and browses past conversation sessions. The tool SHALL return self-describing structured objects so consumers can distinguish success from failure without parsing bare strings.

## ADDED Requirements

### Requirement: searchSession returns structured success object
The `searchSession` tool SHALL return a native structured object with an `ok` boolean field set to `true` on success. The success payload SHALL be spread into the returned object (e.g. `conversation`, `snippets`, or `conversations`) depending on which delegate path was invoked.

#### Scenario: Full conversation retrieval succeeds
- **WHEN** the tool is invoked with a `conversationId` that matches an existing session
- **THEN** the tool returns `{ ok: true, conversation: <content> }`

#### Scenario: Query search succeeds
- **WHEN** the tool is invoked with a `query` that matches one or more sessions
- **THEN** the tool returns `{ ok: true, snippets: <results> }`

#### Scenario: Browse succeeds
- **WHEN** the tool is invoked with no arguments and sessions exist
- **THEN** the tool returns `{ ok: true, conversations: <array> }`

### Requirement: searchSession returns structured failure object
The `searchSession` tool SHALL return a native structured object with an `ok` boolean field set to `false` and an `error` string field carrying a human-readable message on failure.

#### Scenario: No conversations directory exists
- **WHEN** the tool is invoked and the sessions directory does not exist
- **THEN** the tool returns `{ ok: false, error: <message> }`

#### Scenario: Conversation not found
- **WHEN** the tool is invoked with a `conversationId` that does not match any session
- **THEN** the tool returns `{ ok: false, error: <message> }`

#### Scenario: No query matches
- **WHEN** the tool is invoked with a `query` that matches no sessions
- **THEN** the tool returns `{ ok: false, error: <message> }`

#### Scenario: No conversations to browse
- **WHEN** the tool is invoked with no arguments and no sessions exist
- **THEN** the tool returns `{ ok: false, error: <message> }`
