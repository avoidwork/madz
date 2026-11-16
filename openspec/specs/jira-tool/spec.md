# jira-tool Specification

## Purpose
Provides managing JIRA Data Center issues (search, get, create, update, delete, transition, comment, assign, and metadata lookups) via the REST API v2, authenticating with a personal access token (bearer) and targeting only the configured `jira.baseUrl`.

## Requirements

### Requirement: JIRA issue search
The system SHALL execute a JQL search against JIRA Data Center and return matching issues, supporting pagination via `startAt` and `maxResults` and field selection via `fields`.

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
- **THEN** the system creates the issue, sending the project as `{ key }`, and returns the new issue key

#### Scenario: Create an issue using configured defaults
- **WHEN** a user creates an issue without a project or assignee and `jira.project` / `jira.assignee` are configured
- **THEN** the system uses the configured project and assignee

#### Scenario: Search without JQL uses the configured project
- **WHEN** a user searches without JQL and `jira.project` is configured
- **THEN** the system searches `project = "<jira.project>"`

#### Scenario: Transition an issue
- **WHEN** a user provides an issue key and a transition id
- **THEN** the system moves the issue through the workflow transition

#### Scenario: Comment on an issue
- **WHEN** a user provides an issue key and a comment body
- **THEN** the system adds the comment to the issue

#### Scenario: Assign an issue
- **WHEN** a user provides an issue key and an assignee username
- **THEN** the system assigns the issue to that user by `name`

#### Scenario: Delete an issue
- **WHEN** a user provides a valid issue key
- **THEN** the system deletes the issue

### Requirement: JIRA metadata lookups
The system SHALL support metadata lookups for projects, issue types, statuses, fields, and users.

#### Scenario: List projects
- **WHEN** a user requests the projects list
- **THEN** the system returns the available projects

### Requirement: Server-side configuration and authentication
The system SHALL read its settings from the `jira` config section, each mappable from an environment variable: `enabled` (`JIRA_ENABLED`), `baseUrl` (`JIRA_BASE_URL`), `token` (`JIRA_TOKEN`), `project` (`JIRA_PROJECT`), `assignee` (`JIRA_ASSIGNEE`), `rateLimit` and `timeout`. The system SHALL authenticate with the personal access token as `Authorization: Bearer <token>`. Secrets SHALL NOT appear in tool input or output, and the tool input SHALL NOT accept a token, credential name, or base URL.

#### Scenario: Token sent as a bearer token
- **WHEN** `jira.token` is set
- **THEN** the system attaches `Authorization: Bearer <token>` to the request without exposing the token

#### Scenario: No token configured
- **WHEN** `jira.token` is not set
- **THEN** the system sends the request without an Authorization header

#### Scenario: Tool disabled
- **WHEN** `jira.enabled` is `false`
- **THEN** the `jira` tool is not registered

#### Scenario: Missing base URL
- **WHEN** `jira.baseUrl` is not set
- **THEN** the system returns an error indicating the base URL is not configured

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

### Requirement: Single configured target
The system SHALL send every request to the configured `jira.baseUrl` only. The model SHALL NOT be able to supply or override the target host, so no separate allowlist is configured.

#### Scenario: Base URL cannot be overridden by input
- **WHEN** a user passes a `baseUrl` in the tool input
- **THEN** the system rejects the input as invalid

### Requirement: Rate-limit handling
The system SHALL retry on 429 responses using the shared per-host rate limiter and retry budget.

#### Scenario: 429 response is retried
- **WHEN** the JIRA host returns 429
- **THEN** the system retries within the configured retry budget before surfacing the error
