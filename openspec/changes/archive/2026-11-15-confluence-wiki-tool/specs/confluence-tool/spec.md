# Spec Delta

## Purpose

Provides managing Confluence Cloud wiki pages (search, get, create, update, delete, and metadata lookups for spaces, pages, labels, attachments) via the REST API v2, with server-side credential profiles and sandbox allowlist enforcement on the Confluence host.

## ADDED Requirements

### Requirement: Confluence page search
The system SHALL execute a CQL search against Confluence Cloud and return matching pages, supporting pagination via `limit` and `start` and optional excerpt text.

#### Scenario: Search by CQL
- **WHEN** a user provides a CQL query
- **THEN** the system executes the search and returns the matching pages with pagination metadata

#### Scenario: Empty search results
- **WHEN** a CQL query matches no pages
- **THEN** the system returns an empty result set without error

#### Scenario: Paginated results
- **WHEN** a search returns more pages than `limit`
- **THEN** the system returns the first page and exposes `start`/`limit` so the caller can page

### Requirement: Confluence page read and mutation
The system SHALL support reading a single page by id or title and mutating page body, title, and version.

#### Scenario: Get a page by id
- **WHEN** a user provides a valid page id
- **THEN** the system returns the page details

#### Scenario: Get a page by title
- **WHEN** a user provides a page title and a space key
- **THEN** the system returns the matching page details

#### Scenario: Create a page
- **WHEN** a user provides a space key, title, and body
- **THEN** the system creates the page and returns the new page id

#### Scenario: Update a page
- **WHEN** a user provides a page id and new body/title/version
- **THEN** the system updates the page and returns the updated page

#### Scenario: Delete a page
- **WHEN** a user provides a valid page id
- **THEN** the system deletes the page

### Requirement: Confluence metadata lookups
The system SHALL support metadata lookups for spaces, pages, labels, and attachments.

#### Scenario: List spaces
- **WHEN** a user requests the spaces list
- **THEN** the system returns the available spaces

#### Scenario: List pages in a space
- **WHEN** a user requests pages for a space key
- **THEN** the system returns the pages in that space

#### Scenario: List labels on a page
- **WHEN** a user requests labels for a page id
- **THEN** the system returns the labels on that page

#### Scenario: List attachments on a page
- **WHEN** a user requests attachments for a page id
- **THEN** the system returns the attachments on that page

### Requirement: Server-side credential resolution
The system SHALL resolve Confluence credentials (Basic auth `email:token`) from a named, server-side credential profile referencing `process.env` variables only. Secrets SHALL NOT appear in tool input or output.

#### Scenario: Credentials resolved from env
- **WHEN** a credential profile names `CONFLUENCE_EMAIL` and `CONFLUENCE_TOKEN` and both are set
- **THEN** the system attaches Basic auth to the request without exposing the token

#### Scenario: Missing credential env var
- **WHEN** a referenced credential env var is not set
- **THEN** the system returns an error indicating the credential is not configured

### Requirement: Input validation and error mapping
The system SHALL validate all Confluence tool input against a Zod schema before processing, rejecting unknown actions and invalid input, and SHALL map non-2xx Confluence responses to a structured error.

#### Scenario: Unknown action is rejected
- **WHEN** a user requests an action outside the supported enum
- **THEN** the system returns an error listing the valid actions

#### Scenario: Invalid CQL
- **WHEN** a CQL query is rejected by Confluence (400)
- **THEN** the system returns a structured error with the status and Confluence error body

#### Scenario: Unknown page id
- **WHEN** a user provides a page id that does not exist (404)
- **THEN** the system returns a structured error with the status

#### Scenario: Bad credentials
- **WHEN** the Confluence host returns 401
- **THEN** the system returns a structured error indicating authentication failed

### Requirement: Host allowlist and SSRF protection
The system SHALL validate the outbound Confluence host against the configured allowlist and apply DNS-aware SSRF protection via `makeApiRequest`.

#### Scenario: Host outside allowlist is rejected
- **WHEN** the configured Confluence host is not in the allowlist
- **THEN** the system returns an access-denied error

### Requirement: Rate-limit handling
The system SHALL retry on 429 responses using the shared per-host rate limiter and retry budget.

#### Scenario: 429 response is retried
- **WHEN** the Confluence host returns 429
- **THEN** the system retries within the configured retry budget before surfacing the error
