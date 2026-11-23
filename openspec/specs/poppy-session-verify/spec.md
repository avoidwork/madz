# poppy-session-verify Specification

## Purpose
Lets madz verify incoming Poppy-Session JWTs, delegations, and access tokens on company-side endpoints so it can act as a company that accepts personal agents.

## Requirements

### Requirement: Client metadata and public keys are fetched
The system SHALL fetch the client metadata document from the `iss` URL without following redirects and fetch the public keys from the `jwks_uri` named in that metadata.

#### Scenario: Metadata and JWKS are fetched
- **WHEN** a session JWT is presented for verification
- **THEN** the system fetches the client metadata from `iss` without following redirects and fetches the public keys from `jwks_uri`

#### Scenario: Metadata fetch failure is reported
- **WHEN** the client metadata cannot be fetched from `iss`
- **THEN** the system returns an error

### Requirement: Session JWT delegation and signature are verified
The system SHALL verify the session JWT's delegation and signature, checking the delegation's `typ`, `iss`, and `exp` (at most 24 hours after `iat`), and verifying the session JWT with the delegated key in `cnf.jwk`. The system SHALL verify the session JWT's `kid` against the delegated key thumbprint.

#### Scenario: Valid delegation and signature are accepted
- **WHEN** a session JWT carries a valid delegation with the expected `typ`, `iss`, and `exp`, and is signed by the delegated key in `cnf.jwk`
- **THEN** the system accepts the session JWT

#### Scenario: Missing delegation is rejected
- **WHEN** a session JWT is presented without a delegation
- **THEN** the system returns `invalid_session` (400)

#### Scenario: Expired delegation is rejected
- **WHEN** a session JWT carries a delegation whose `exp` is more than 24 hours after `iat` or has passed
- **THEN** the system returns `invalid_session` (400)

#### Scenario: Signature mismatch is rejected
- **WHEN** a session JWT is not signed by the delegated key in `cnf.jwk`
- **THEN** the system returns `invalid_session` (400)

#### Scenario: Session kid mismatch is rejected
- **WHEN** a session JWT's `kid` does not match the delegated key thumbprint
- **THEN** the system returns `invalid_session` (400)

### Requirement: Session JWT claims are validated
The system SHALL validate the session JWT claims, checking `typ: poppy-session+jwt`, `aud` equals the company identifier, `htm`/`htu` match the request method and URL, and `iat` is within an acceptance window.

#### Scenario: Valid claims are accepted
- **WHEN** a session JWT has `typ: poppy-session+jwt`, `aud` equal to the company identifier, `htm`/`htu` matching the request, and `iat` within the acceptance window
- **THEN** the system accepts the session JWT

#### Scenario: Wrong aud is rejected
- **WHEN** a session JWT has an `aud` that does not equal the company identifier
- **THEN** the system returns `invalid_session` (400)

#### Scenario: htm/htu mismatch is rejected
- **WHEN** a session JWT has `htm`/`htu` that do not match the request method and URL
- **THEN** the system returns `invalid_session` (400)

#### Scenario: Stale iat is rejected
- **WHEN** a session JWT has an `iat` outside the acceptance window
- **THEN** the system returns `invalid_session` (400)

### Requirement: Access token binding is validated
The system SHALL check that `ath` matches the access token when present, and that the token was issued to the same `client_id` as `iss`. When no access token is present, the system SHALL enforce that `ath` is absent.

#### Scenario: Matching ath is accepted
- **WHEN** an access token is present and `ath` matches its hash
- **THEN** the system accepts the session JWT

#### Scenario: ath mismatch is rejected
- **WHEN** an access token is present and `ath` does not match its hash
- **THEN** the system returns `invalid_session` (400)

#### Scenario: Token issued to a different client is rejected
- **WHEN** the access token was issued to a `client_id` different from `iss`
- **THEN** the system returns `invalid_session` (400)

#### Scenario: ath is absent when no access token is present
- **WHEN** no access token is present and the session JWT carries an `ath` claim
- **THEN** the system returns `invalid_session` (400)

### Requirement: Session is looked up by client, sid, and user
The system SHALL look up the session by `client_id`, `sid`, and user ID, starting a new signed-out session for unknown combinations.

#### Scenario: Known session is returned
- **WHEN** a session matching `client_id`, `sid`, and user ID exists
- **THEN** the system returns that session

#### Scenario: Unknown combination starts a new signed-out session
- **WHEN** no session matches the `client_id`, `sid`, and user ID combination
- **THEN** the system starts a new signed-out session

### Requirement: Verification failures return protocol errors
The system SHALL return `invalid_session` (400) or `session_ended` (400) on verification failure. The verifying endpoint SHALL check the `Poppy-Version` header.

#### Scenario: invalid_session is returned on verification failure
- **WHEN** session verification fails
- **THEN** the system returns `invalid_session` with status 400

#### Scenario: session_ended is returned when the session has ended
- **WHEN** the session has ended
- **THEN** the system returns `session_ended` with status 400

#### Scenario: Poppy-Version header is checked
- **WHEN** a request is verified at the verifying endpoint
- **THEN** the system checks the `Poppy-Version` header and returns `version_unsupported` (400) when it is unsupported
