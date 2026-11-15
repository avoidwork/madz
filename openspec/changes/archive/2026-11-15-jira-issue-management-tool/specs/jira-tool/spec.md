# Spec Delta

## Purpose

Provides managing JIRA Cloud issues (search, get, create, update, delete, transition, comment, assign, and metadata lookups) via the REST API v3, with server-side credential profiles and sandbox allowlist enforcement on the JIRA host.

## ADDED Requirements

### Requirement: JIRA issue search
The system SHALL execute a JQL search against JIRA Cloud and return matching issues, supporting pagination via `startAt` and `maxResults` and field selection via `fields`.

#### Scenario: Search by JQL
- **WHEN** a user provides a JQL query
- **THEN** the system executes the search and returns the matching issues with pagination metadata

#### Scenario: Empty JQL results
- **WHEN** a JQL query matches no issues
- **THEN** the system returns an empty result set without error

#### Scenario: Paginated results
- **WHEN** a search returns more issues than `maxResults`
- **THEN** the system returns the first page and exposes `startAt`/`total` so the caller can page

### Requirement: JIRA issue read and mutation
The system SHALL support reading a single issue by key and mutating issue fields, workflow state, comments, and assignment.

#### Scenario: Get an issue by key
- **WHEN** a user provides a valid issue key
- **THEN** the system returns the issue details

#### Scenario: Create an issue
- **WHEN** a user provides a project, issue type, and summary
- **THEN** the system creates the issue and returns the new issue key

#### Scenario: Transition an issue
- **WHEN** a user provides an issue key and a transition id
- **THEN** the system moves the issue through the workflow transition

#### Scenario: Comment on an issue
- **WHEN** a user provides an issue key and a comment body
- **THEN** the system adds the comment to the issue

#### Scenario: Assign an issue
- **WHEN** a user provides an issue key and an assignee
- **THEN** the system assigns the issue to the user

#### Scenario: Delete an issue
- **WHEN** a user provides a valid issue key
- **THEN** the system deletes the issue

### Requirement: JIRA metadata lookups
The system SHALL support metadata lookups for projects, issue types, statuses, fields, and users.

#### Scenario: List projects
- **WHEN** a user requests the projects list
- **THEN** the system returns the available projects

### Requirement: Server-side credential resolution
The system SHALL resolve JIRA credentials (Basic auth `email:token`) from a named, server-side credential profile referencing `process.env` variables only. Secrets SHALL NOT appear in tool input or output.

#### Scenario: Credentials resolved from env
- **WHEN** a credential profile names `JIRA_EMAIL` and `JIRA_TOKEN` and both are set
- **THEN** the system attaches Basic auth to the request without exposing the token

#### Scenario: Missing credential env var
- **WHEN** a referenced credential env var is not set
- **THEN** the system returns an error indicating the credential is not configured

### Requirement: Input validation and error mapping
The system SHALL validate all JIRA tool input against a Zod schema before processing, rejecting unknown actions and invalid input, and SHALL map non-2xx JIRA responses to a structured error.

#### Scenario: Unknown action is rejected
- **WHEN** a user requests an action outside the supported enum
- **THEN** the system returns an error listing the valid actions

#### Scenario: Invalid JQL
- **WHEN** a JQL query is rejected by JIRA (400)
- **THEN** the system returns a structured error with the status and JIRA error body

#### Scenario: Unknown issue key
- **WHEN** a user provides an issue key that does not exist (404)
- **THEN** the system returns a structured error with the status

#### Scenario: Bad credentials
- **WHEN** the JIRA host returns 401
- **THEN** the system returns a structured error indicating authentication failed

### Requirement: Host allowlist and SSRF protection
The system SHALL validate the outbound JIRA host against the configured allowlist and apply DNS-aware SSRF protection via `makeApiRequest`.

#### Scenario: Host outside allowlist is rejected
- **WHEN** the configured JIRA host is not in the allowlist
- **THEN** the system returns an access-denied error

### Requirement: Rate-limit handling
The system SHALL retry on 429 responses using the shared per-host rate limiter and retry budget.

#### Scenario: 429 response is retried
- **WHEN** the JIRA host returns 429
- **THEN** the system retries within the configured retry budget before surfacing the error
