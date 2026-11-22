# Spec Delta

## MODIFIED Requirements

### Requirement: OAuth metadata is discovered and validated
The system SHALL read the company's OAuth Authorization Server Metadata (RFC 8414) and protected resource metadata (RFC 9728) to discover the issuer, authorization, token, device authorization, and revocation endpoints, validating the responses against a schema. The protected resource metadata SHALL be fetched from the domain host.

#### Scenario: Authorization server metadata is discovered
- **WHEN** the system fetches the authorization server metadata for a company
- **THEN** it returns the issuer and the authorization, token, device authorization, and revocation endpoints

#### Scenario: Protected resource metadata is discovered
- **WHEN** the system fetches the protected resource metadata for a company
- **THEN** it returns the resource and authorization server identifiers

#### Scenario: Malformed metadata is rejected
- **WHEN** the fetched metadata is malformed or missing required fields
- **THEN** the system returns an error

#### Scenario: Issuer mismatch is rejected
- **WHEN** the discovered issuer does not match the expected issuer
- **THEN** the system returns an error

#### Scenario: Protected resource metadata is fetched from the domain host
- **WHEN** the system fetches protected resource metadata
- **THEN** it fetches from the domain host rather than the issuer host

### Requirement: Direct Sign-In builds an authorization URL with PKCE
The system SHALL build the authorization URL for Direct Sign-In with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, and `code_challenge_method=S256`. The system SHALL include `prompt=consent` unless the redirect returns on the same device.

#### Scenario: Authorization URL includes required parameters
- **WHEN** a Direct Sign-In authorization URL is built
- **THEN** it includes `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, and `code_challenge_method=S256`

#### Scenario: PKCE code challenge is derived from the verifier
- **WHEN** a code verifier is generated
- **THEN** the S256 code challenge is derived from it

#### Scenario: Cross-device Direct Sign-In enforces prompt=consent
- **WHEN** a cross-device Direct Sign-In authorization URL is built
- **THEN** it includes `prompt=consent`

#### Scenario: Same-device Direct Sign-In does not require prompt=consent
- **WHEN** a same-device Direct Sign-In authorization URL is built
- **THEN** it does not require `prompt=consent`

### Requirement: Direct Sign-In validates the issuer on the redirect
The system SHALL validate the `iss` claim on the redirect callback against the expected issuer before exchanging the code. The `iss` check SHALL be mandatory.

#### Scenario: Issuer on redirect is validated
- **WHEN** a redirect callback is received
- **THEN** the system validates its `iss` claim against the expected issuer

#### Scenario: Issuer mismatch on redirect is rejected
- **WHEN** the redirect callback's `iss` does not match the expected issuer
- **THEN** the system returns an error

#### Scenario: Missing issuer on redirect is rejected
- **WHEN** the redirect callback omits the `iss` claim
- **THEN** the system returns an error

### Requirement: Device Sign-In requests a device code
The system SHALL request a device code from the device authorization endpoint and surface the verification URI and user code to the user. The device code request SHALL carry a client assertion.

#### Scenario: Device code is requested
- **WHEN** a Device Sign-In flow is started
- **THEN** the system requests a device code and returns the verification URI and user code

#### Scenario: Device code request failure is reported
- **WHEN** the device authorization endpoint returns an error
- **THEN** the system returns an error

#### Scenario: Device code request carries a client assertion
- **WHEN** a device code is requested
- **THEN** the request includes a client assertion

### Requirement: Device Sign-In polls the token endpoint
The system SHALL poll the token endpoint at the advertised interval until the flow is approved, denied, or expired. Each poll SHALL carry a client assertion.

#### Scenario: Device flow polls until approved
- **WHEN** the device flow is pending approval
- **THEN** the system polls the token endpoint until tokens are returned

#### Scenario: Device flow handles access denied
- **WHEN** the token endpoint returns `access_denied`
- **THEN** the system returns an error

#### Scenario: Device flow handles expiration
- **WHEN** the device code expires before approval
- **THEN** the system returns an error

#### Scenario: Device flow polls carry a client assertion
- **WHEN** the device flow polls the token endpoint
- **THEN** each poll request includes a client assertion

### Requirement: Tokens are revoked
The system SHALL revoke an access or refresh token at the revocation endpoint. The revocation request SHALL carry a client assertion and default `token_type_hint` to `refresh_token`.

#### Scenario: Access token is revoked
- **WHEN** an access token is revoked
- **THEN** the system calls the revocation endpoint

#### Scenario: Refresh token is revoked
- **WHEN** a refresh token is revoked
- **THEN** the system calls the revocation endpoint

#### Scenario: Revocation request carries a client assertion
- **WHEN** a token is revoked
- **THEN** the revocation request includes a client assertion

#### Scenario: Revocation defaults token_type_hint to refresh_token
- **WHEN** a token is revoked without an explicit `token_type_hint`
- **THEN** the system defaults `token_type_hint` to `refresh_token`

## ADDED Requirements

### Requirement: Device Sign-In surfaces verification URI host
The system SHALL check that the verification URI host is the issuer/domain (or a subdomain) and surface `organization.name`/`domain` in the Device Sign-In flow.

#### Scenario: Verification URI host is checked
- **WHEN** a Device Sign-In flow surfaces a verification URI
- **THEN** the system checks the verification URI host is the issuer/domain or a subdomain

#### Scenario: Verification URI host mismatch is rejected
- **WHEN** the verification URI host is not the issuer/domain or a subdomain
- **THEN** the system returns an error

#### Scenario: Organization name and domain are surfaced
- **WHEN** a Device Sign-In flow is presented
- **THEN** the system surfaces `organization.name` and `organization.domain`
