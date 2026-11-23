# Spec Delta

## ADDED Requirements

### Requirement: JIRA remote link listing
The system SHALL support a `remoteLinks` action that lists existing remote links (web links) for an issue via `GET /rest/api/2/issue/<KEY>/remotelink`. The action SHALL require an issue `key` and SHALL list links when no `link` object is supplied.

#### Scenario: List remote links for an issue
- **WHEN** a user requests the `remoteLinks` action with an issue `key` and no `link` object
- **THEN** the system issues a GET to `/rest/api/2/issue/<KEY>/remotelink` and returns the existing remote links

#### Scenario: Remote links require a key
- **WHEN** a user requests the `remoteLinks` action without an issue `key`
- **THEN** the system returns a required-field error and sends no request

### Requirement: JIRA remote link creation
The system SHALL support creating a remote link for an issue via `POST /rest/api/2/issue/<KEY>/remotelink` with a `link` object. The `link` object SHALL require `url` and `title` and MAY include `icon` and `status`, sent as `{ object: { url, title, icon?, status? } }`.

#### Scenario: Create a remote link
- **WHEN** a user requests the `remoteLinks` action with an issue `key` and a `link` object containing `url` and `title`
- **THEN** the system issues a POST to `/rest/api/2/issue/<KEY>/remotelink` with body `{ object: { url, title } }` and returns the created link (201 with `id` and `self`)

#### Scenario: Create a remote link with icon and status
- **WHEN** a user requests the `remoteLinks` action with a `link` object that also includes `icon` and `status`
- **THEN** the system includes `icon` and `status` in the `object` payload

#### Scenario: Remote link payload requires url and title
- **WHEN** a user requests the `remoteLinks` action with a `link` object missing `url` or `title`
- **THEN** the system rejects the input as invalid and sends no request
