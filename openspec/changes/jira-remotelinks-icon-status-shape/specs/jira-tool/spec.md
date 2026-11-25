# Spec Delta

## MODIFIED Requirements

### Requirement: JIRA remote link creation
The system SHALL support creating a remote link for an issue via `POST /rest/api/2/issue/<KEY>/remotelink` with a `link` object. The `link` object SHALL require `url` and `title` and MAY include `icon` and `status`, sent as `{ object: { url, title, icon?, status? } }`. The optional `icon` and `status` fields SHALL be objects matching the Jira Data Center REST API v2 remote-link schema.

#### Scenario: Create a remote link
- **WHEN** a user requests the `remoteLinks` action with an issue `key` and a `link` object containing `url` and `title`
- **THEN** the system issues a POST to `/rest/api/2/issue/<KEY>/remotelink` with body `{ object: { url, title } }` and returns the created link (201 with `id` and `self`)

#### Scenario: Create a remote link with icon and status
- **WHEN** a user requests the `remoteLinks` action with a `link` object that also includes `icon` and `status` as objects
- **THEN** the system includes `icon` and `status` as objects in the `object` payload, preserving their nested fields

#### Scenario: Remote link payload requires url and title
- **WHEN** a user requests the `remoteLinks` action with a `link` object missing `url` or `title`
- **THEN** the system rejects the input as invalid and sends no request

#### Scenario: Remote link icon and status accept partial objects
- **WHEN** a user requests the `remoteLinks` action with a `link` object whose `icon` has only `url16x16` or whose `status` has only `resolved`
- **THEN** the system accepts the partial objects and sends them through in the `object` payload
