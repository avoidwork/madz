# Spec Delta

## MODIFIED Requirements

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
