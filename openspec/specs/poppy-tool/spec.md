# poppy-tool Specification

## Purpose
Lets madz discover a company's Personal Agent Protocol (Poppy) capabilities by fetching and
validating its well-known discovery document before acting as a Personal Agent.

## Requirements

### Requirement: Discover action fetches the discovery document
The system SHALL provide a `poppy` tool whose `discover` action takes a company domain and fetches `https://{domain}/.well-known/poppy.json` over HTTPS.

#### Scenario: Successful discovery
- **WHEN** `discover` is invoked with a domain that serves a valid document
- **THEN** it returns `ok: true` with a normalized summary

#### Scenario: Invalid domain input
- **WHEN** `discover` is invoked without a domain, or with a value that is not a bare hostname
- **THEN** it returns `ok: false` with an error and sends no request

### Requirement: Redirects must stay on HTTPS and end at the well-known path
The system SHALL follow redirects only when every hop is HTTPS, and SHALL require the final URL path to be exactly `/.well-known/poppy.json` with no query.

#### Scenario: HTTPS redirect to the well-known path
- **WHEN** the document URL redirects over HTTPS to `/.well-known/poppy.json` on another host
- **THEN** discovery succeeds and uses the final host for the domain check

#### Scenario: Redirect to HTTP
- **WHEN** any redirect hop is not HTTPS
- **THEN** discovery fails with an error

#### Scenario: Redirect to a different path or a query
- **WHEN** the final URL path is not `/.well-known/poppy.json` or it carries a query string
- **THEN** discovery fails with an error

### Requirement: Document validation
The system SHALL validate the document against a schema covering `protocol_version`, `organization`, `auth`, `agent`, `apis`, `web`, `tasks` and `extensions`.

#### Scenario: Malformed document
- **WHEN** the response body is not JSON or fails schema validation
- **THEN** discovery fails with an error naming the invalid fields

### Requirement: Organization domain matches the serving host
The system SHALL verify that `organization.domain` equals the host that served the document.

#### Scenario: Domain mismatch
- **WHEN** `organization.domain` differs from the serving host
- **THEN** discovery fails with an error

### Requirement: OAuth issuer verification
The system SHALL resolve the OAuth issuer from the domain's `/.well-known/oauth-protected-resource` metadata when present, and verify that the issuer's metadata lists the domain in `protected_resources`.

#### Scenario: Issuer lists the domain
- **WHEN** protected resource metadata names an issuer whose metadata `protected_resources` includes the domain
- **THEN** the summary reports the issuer as verified

#### Scenario: Issuer does not list the domain
- **WHEN** the issuer's `protected_resources` does not include the domain
- **THEN** discovery fails with an error

#### Scenario: No protected resource metadata
- **WHEN** the domain serves no protected resource metadata (HTTP 404)
- **THEN** discovery succeeds and the summary reports no issuer

### Requirement: Normalized summary
The system SHALL return organization, protocol version, offered channels (agent, apis, web), scopes and scope hints, sign-in options, and extensions.

#### Scenario: Channels reported
- **WHEN** the document defines `agent` and `web` but no `apis`
- **THEN** the summary lists channels `agent` and `web`

### Requirement: Server-side policy and registration
The system SHALL read the rate limit and timeout from the server-side `poppy` config section, SHALL register the tool with `network:outbound` permission, and SHALL NOT register it when `poppy.enabled` is `false`.

#### Scenario: Tool disabled
- **WHEN** `poppy.enabled` is `false`
- **THEN** the `poppy` tool is not registered
