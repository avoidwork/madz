# Spec Delta

## Purpose

Lets madz obtain account access tokens and refresh tokens on the user's behalf via Poppy OAuth Direct Sign-In (authorization code + PKCE) and Device Sign-In (device authorization grant), including metadata discovery, refresh token rotation and revocation, and DPoP support.

## ADDED Requirements

### Requirement: OAuth metadata is discovered and validated
The system SHALL read the company's OAuth Authorization Server Metadata (RFC 8414) and protected resource metadata (RFC 9728) to discover the issuer, authorization, token, device authorization, and revocation endpoints, validating the responses against a schema.

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

### Requirement: Direct Sign-In builds an authorization URL with PKCE
The system SHALL build the authorization URL for Direct Sign-In with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, and `code_challenge_method=S256`.

#### Scenario: Authorization URL includes required parameters
- **WHEN** a Direct Sign-In authorization URL is built
- **THEN** it includes `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, and `code_challenge_method=S256`

#### Scenario: PKCE code challenge is derived from the verifier
- **WHEN** a code verifier is generated
- **THEN** the S256 code challenge is derived from it

#### Scenario: Cross-device Direct Sign-In enforces prompt=consent
- **WHEN** a cross-device Direct Sign-In authorization URL is built
- **THEN** it includes `prompt=consent`

### Requirement: Direct Sign-In validates the issuer on the redirect
The system SHALL validate the `iss` claim on the redirect callback against the expected issuer before exchanging the code.

#### Scenario: Issuer on redirect is validated
- **WHEN** a redirect callback is received
- **THEN** the system validates its `iss` claim against the expected issuer

#### Scenario: Issuer mismatch on redirect is rejected
- **WHEN** the redirect callback's `iss` does not match the expected issuer
- **THEN** the system returns an error

### Requirement: Direct Sign-In exchanges the code at the token endpoint
The system SHALL exchange the authorization code at the token endpoint using a client assertion.

#### Scenario: Code is exchanged for tokens
- **WHEN** a Direct Sign-In code is exchanged at the token endpoint
- **THEN** the system sends a client assertion and returns the access and refresh tokens

#### Scenario: Invalid grant is rejected
- **WHEN** the token endpoint returns `invalid_grant`
- **THEN** the system returns an error

#### Scenario: Invalid scope is rejected
- **WHEN** the token endpoint returns `invalid_scope`
- **THEN** the system returns an error

### Requirement: Device Sign-In requests a device code
The system SHALL request a device code from the device authorization endpoint and surface the verification URI and user code to the user.

#### Scenario: Device code is requested
- **WHEN** a Device Sign-In flow is started
- **THEN** the system requests a device code and returns the verification URI and user code

#### Scenario: Device code request failure is reported
- **WHEN** the device authorization endpoint returns an error
- **THEN** the system returns an error

### Requirement: Device Sign-In polls the token endpoint
The system SHALL poll the token endpoint at the advertised interval until the flow is approved, denied, or expired.

#### Scenario: Device flow polls until approved
- **WHEN** the device flow is pending approval
- **THEN** the system polls the token endpoint until tokens are returned

#### Scenario: Device flow handles access denied
- **WHEN** the token endpoint returns `access_denied`
- **THEN** the system returns an error

#### Scenario: Device flow handles expiration
- **WHEN** the device code expires before approval
- **THEN** the system returns an error

### Requirement: Refresh tokens are rotated
The system SHALL exchange a refresh token at the token endpoint for a new access token and rotated refresh token.

#### Scenario: Refresh token is exchanged
- **WHEN** a refresh token is presented
- **THEN** the system exchanges it for a new access token and rotated refresh token

#### Scenario: Invalid refresh token is rejected
- **WHEN** the token endpoint returns `invalid_grant` for a refresh token
- **THEN** the system returns an error

### Requirement: Tokens are revoked
The system SHALL revoke an access or refresh token at the revocation endpoint.

#### Scenario: Access token is revoked
- **WHEN** an access token is revoked
- **THEN** the system calls the revocation endpoint

#### Scenario: Refresh token is revoked
- **WHEN** a refresh token is revoked
- **THEN** the system calls the revocation endpoint

### Requirement: DPoP proofs are generated when supported
The system SHALL generate DPoP proofs bound to the token endpoint when the issuer's metadata lists `dpop_signing_alg_values_supported`.

#### Scenario: DPoP proof is generated when advertised
- **WHEN** the issuer metadata lists `dpop_signing_alg_values_supported`
- **THEN** the system generates a DPoP proof and includes it in token requests

#### Scenario: No DPoP proof when not advertised
- **WHEN** the issuer metadata does not list `dpop_signing_alg_values_supported`
- **THEN** the system does not generate a DPoP proof

#### Scenario: Refresh tokens are bound to the DPoP key
- **WHEN** DPoP is supported and a refresh token is used
- **THEN** the refresh token is bound to the DPoP key

### Requirement: OAuth responses are validated against a schema
The system SHALL validate all OAuth responses (metadata, token, device code) against a schema, rejecting invalid responses.

#### Scenario: Invalid token response is rejected
- **WHEN** the token endpoint returns a malformed response
- **THEN** the system returns an error

#### Scenario: Invalid device code response is rejected
- **WHEN** the device authorization endpoint returns a malformed response
- **THEN** the system returns an error

### Requirement: Secrets are kept out of model context
The system SHALL keep access tokens, refresh tokens, authorization codes, and PKCE verifiers out of the model context, returning only non-secret results.

#### Scenario: Tokens are not returned to the model
- **WHEN** a sign-in flow completes
- **THEN** the system does not expose the access token, refresh token, authorization code, or PKCE verifier to the model context

### Requirement: Client assertion audience is the issuer
The system SHALL set the client assertion `aud` to the company's issuer.

#### Scenario: Client assertion aud is the issuer
- **WHEN** a client assertion is generated for a token exchange
- **THEN** its `aud` is the company's issuer
