# Spec Delta

## MODIFIED Requirements

### Requirement: Poppy document validation
The system SHALL validate the fetched `poppy.json` against the protocol's required fields: `protocol_version`, `organization` (with `name` and `domain`), and at least one of `agent`, `apis`, or `web`. The system SHALL reject documents missing required fields or with malformed JSON. The system SHALL enforce cross-field constraints: a `web.disabled: true` document MUST NOT list `browser_session_endpoint`, and a company with `auth.disabled: true` MUST NOT list the Mediated Sign-In extension or `signed_in` access.

#### Scenario: Valid document passes validation
- **WHEN** the document contains all required fields
- **THEN** the tool accepts it and returns the normalized representation

#### Scenario: Missing required field is rejected
- **WHEN** the document is missing `protocol_version` or `organization`
- **THEN** the tool returns an error

#### Scenario: Malformed JSON is rejected
- **WHEN** the fetched body is not valid JSON
- **THEN** the tool returns an error

#### Scenario: No agent, apis, or web is rejected
- **WHEN** the document has none of `agent`, `apis`, or `web`
- **THEN** the tool returns an error

#### Scenario: web.disabled document must not list browser_session_endpoint
- **WHEN** a document sets `web.disabled: true` and lists `browser_session_endpoint`
- **THEN** the tool returns an error

#### Scenario: auth.disabled document must not list mediated sign-in or signed_in
- **WHEN** a company with `auth.disabled: true` lists the Mediated Sign-In extension or `signed_in` access
- **THEN** the tool returns an error

### Requirement: URL and address validation
The system SHALL validate that all URLs in the document are HTTPS and not loopback/private/link-local addresses (unless configured to allow them). The system SHALL resolve DNS to detect private addresses.

#### Scenario: Non-HTTPS URL in document is rejected
- **WHEN** a document URL uses `http://`
- **THEN** the tool returns an error

#### Scenario: Private address is rejected
- **WHEN** a document URL points to a loopback/private/link-local address
- **THEN** the tool returns an error

#### Scenario: DNS-resolved private address is rejected
- **WHEN** a document URL hostname resolves to a private address via DNS
- **THEN** the tool returns an error

### Requirement: Normalized representation and per-domain cache
The system SHALL return a normalized, typed representation of the document, and SHALL cache the document per-domain with a TTL. The system SHALL support `supported_versions` selection, choosing the newest compatible version. From version 1.0, a newer minor version SHALL be accepted. The system SHALL cross-check the issuer and protected-resource metadata, validate `supported_versions` URLs, and fetch the selected version's document.

#### Scenario: Returns normalized representation
- **WHEN** a valid document is fetched
- **THEN** the tool returns a normalized object

#### Scenario: Caches per-domain within TTL
- **WHEN** the same domain is requested again within the TTL
- **THEN** the tool returns the cached document without refetching

#### Scenario: Selects newest supported version
- **WHEN** the document lists multiple `supported_versions`
- **THEN** the tool selects the newest compatible version

#### Scenario: Newer minor version is accepted from 1.0
- **WHEN** a 1.0 agent encounters a 1.1 document
- **THEN** the tool accepts the newer minor version

#### Scenario: Issuer and protected-resource metadata are cross-checked
- **WHEN** a document is discovered
- **THEN** the tool cross-checks the issuer and protected-resource metadata

#### Scenario: supported_versions URLs are validated
- **WHEN** a document lists `supported_versions`
- **THEN** the tool validates the URLs are HTTPS on the same host

#### Scenario: Selected version document is fetched
- **WHEN** a version is selected from `supported_versions`
- **THEN** the tool fetches the selected version's document

## ADDED Requirements

### Requirement: scope_hints.changes handling
The system SHALL treat unknown `scope_hints.changes` values as `irreversible` rather than rejecting the document.

#### Scenario: Known changes value is accepted
- **WHEN** a document's `scope_hints.changes` is a known value
- **THEN** the tool accepts the document

#### Scenario: Unknown changes value is treated as irreversible
- **WHEN** a document's `scope_hints.changes` is an unrecognized value
- **THEN** the tool treats it as `irreversible` and accepts the document
