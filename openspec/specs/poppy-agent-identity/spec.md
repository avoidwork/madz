# poppy-agent-identity Specification

## Purpose
Lets madz publish and manage its Poppy agent identity: a fetchable client metadata document (CIMD) at the agent's `client_id` URL, its public JWK key set, and RFC 7523 client assertion signing.

## Requirements

### Requirement: Client metadata document is served at client_id URL
The system SHALL serve a client metadata document (CIMD) at the configured `client_id` URL. The document's `client_id` field SHALL equal the URL it was fetched from. The document SHALL expose `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method`. The CIMD field values SHALL be sourceable from the `poppy` config section and its `POPPY_*` environment variables as a fallback when not provided as tool input parameters. The system SHALL validate that `client_id` equals the fetch URL.

#### Scenario: Document client_id equals fetch URL
- **WHEN** the metadata document is generated for a configured `client_id` URL
- **THEN** the document's `client_id` field equals that URL

#### Scenario: Document exposes required fields
- **WHEN** the metadata document is generated
- **THEN** it includes `client_name`, `logo_uri`, `jwks_uri`, `redirect_uris`, and `token_endpoint_auth_method`

#### Scenario: token_endpoint_auth_method is private_key_jwt
- **WHEN** the metadata document is generated
- **THEN** `token_endpoint_auth_method` is `private_key_jwt`

#### Scenario: CIMD values sourced from config when input omitted
- **WHEN** the `build_metadata` operation is invoked without `clientId`, `clientName`, `jwksUri`, or `redirectUris` input parameters
- **THEN** the values are sourced from the `poppy` config section / `POPPY_*` environment variables

#### Scenario: CIMD values error when neither input nor config present
- **WHEN** the `build_metadata` operation is invoked without input parameters and no `poppy` config / `POPPY_*` env vars are present
- **THEN** the operation returns an error indicating the required fields are missing

#### Scenario: client_id mismatch with fetch URL is rejected
- **WHEN** the metadata document's `client_id` does not equal the URL it was fetched from
- **THEN** the system rejects the document

### Requirement: Metadata document validates against a schema
The system SHALL validate the client metadata document against a Zod schema before use, rejecting documents with missing or malformed fields.

#### Scenario: Valid metadata document passes validation
- **WHEN** the document contains all required fields
- **THEN** validation succeeds

#### Scenario: Missing jwks_uri is rejected
- **WHEN** the document is missing `jwks_uri`
- **THEN** validation fails

### Requirement: JWK key set is published at jwks_uri
The system SHALL generate and manage the agent's JWK key set, publishing public keys only at `jwks_uri`. The `jwks_uri` SHALL be on the same domain as `client_id`. Private key material SHALL NOT be exposed in the published key set.

#### Scenario: JWKS contains public keys only
- **WHEN** the key set is published
- **THEN** it contains public keys and no private key material

#### Scenario: jwks_uri shares client_id domain
- **WHEN** the key set is published
- **THEN** `jwks_uri` is on the same domain as `client_id`

### Requirement: redirect_uris are validated
The system SHALL manage `redirect_uris`, accepting HTTPS URLs on the same domain as `client_id` and loopback redirect URIs per RFC 8252 §7.3. Off-domain and non-HTTPS redirect URIs SHALL be rejected.

#### Scenario: On-domain HTTPS redirect URI is accepted
- **WHEN** a redirect URI is HTTPS and on the same domain as `client_id`
- **THEN** it is accepted

#### Scenario: Loopback redirect URI is accepted
- **WHEN** a redirect URI is a loopback URI per RFC 8252 §7.3
- **THEN** it is accepted

#### Scenario: Off-domain redirect URI is rejected
- **WHEN** a redirect URI is on a different domain than `client_id`
- **THEN** it is rejected

#### Scenario: Non-HTTPS redirect URI is rejected
- **WHEN** a redirect URI uses `http://`
- **THEN** it is rejected

### Requirement: Client assertions are signed per RFC 7523
The system SHALL sign client assertions (RFC 7523) with a key from `jwks_uri`. The assertion SHALL include `aud` set to the company's issuer, `iat`, a unique `jti`, and `exp` at most 5 minutes after `iat`. The system SHALL support ES256 and PS384 signing.

#### Scenario: Assertion includes required claims
- **WHEN** a client assertion is signed
- **THEN** it includes `aud` (the company's issuer), `iat`, a unique `jti`, and `exp` at most 5 minutes after `iat`

#### Scenario: Assertion exp is at most 5 minutes after iat
- **WHEN** a client assertion is signed
- **THEN** `exp` minus `iat` is at most 300 seconds

#### Scenario: Assertion jti is unique
- **WHEN** multiple client assertions are signed
- **THEN** each has a unique `jti`

#### Scenario: ES256 signing is supported
- **WHEN** a client assertion is signed with ES256
- **THEN** the assertion is a valid JWT signed with ES256

#### Scenario: PS384 signing is supported
- **WHEN** a client assertion is signed with PS384
- **THEN** the assertion is a valid JWT signed with PS384

#### Scenario: Unsupported signing algorithm is rejected
- **WHEN** a client assertion is requested with an unsupported algorithm
- **THEN** the system returns an error
