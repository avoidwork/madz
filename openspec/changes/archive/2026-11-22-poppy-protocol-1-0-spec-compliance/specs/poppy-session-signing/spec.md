# Spec Delta

## MODIFIED Requirements

### Requirement: Delegations are issued
The system SHALL issue a short-lived delegation JWT (`typ: poppy-delegation+jwt`) signed by a key in `jwks_uri`, naming the delegated key in `cnf.jwk`, with `exp` at most 24 hours after `iat`. The delegation payload SHALL carry only `iss`, `cnf.jwk`, `iat`, `exp`, and `jti`; it SHALL NOT carry the user ID or the company issuer as `sub`/`aud`. The returned `kid` SHALL name the signing key from `jwks_uri`.

#### Scenario: Delegation includes required claims
- **WHEN** a delegation is issued
- **THEN** it has `typ: poppy-delegation+jwt`, is signed by a key in `jwks_uri`, and names the delegated key in `cnf.jwk`

#### Scenario: Delegation exp is at most 24 hours after iat
- **WHEN** a delegation is issued
- **THEN** `exp` minus `iat` is at most 86400 seconds

#### Scenario: Delegation payload carries only spec fields
- **WHEN** a delegation is issued
- **THEN** its payload contains only `iss`, `cnf.jwk`, `iat`, `exp`, and `jti`, and does not contain the user ID or company issuer as `sub`/`aud`

#### Scenario: Delegation kid names the signing key
- **WHEN** a delegation is issued
- **THEN** the returned `kid` names the key in `jwks_uri` that signed the delegation

### Requirement: Session and delegation claims are validated
The system SHALL validate session and delegation claims against a Zod schema before signing, rejecting invalid input. The delegation input schema SHALL NOT require `userId` or `audience`.

#### Scenario: Invalid session input is rejected
- **WHEN** session signing input is missing required fields
- **THEN** the system returns an error

#### Scenario: Invalid delegation input is rejected
- **WHEN** delegation issuance input is missing required fields
- **THEN** the system returns an error

#### Scenario: Delegation input does not require userId or audience
- **WHEN** a delegation is issued without `userId` or `audience` input
- **THEN** the system issues the delegation successfully

### Requirement: Poppy headers are emitted
The system SHALL emit the `Poppy-Version` and `Poppy-Extensions` headers alongside the session header. The `Poppy-Extensions` header SHALL NOT declare a non-existent `session` extension.

#### Scenario: Poppy headers accompany session header
- **WHEN** a session is signed
- **THEN** the result includes `Poppy-Session`, `Poppy-Version`, and `Poppy-Extensions` header values

#### Scenario: Poppy-Extensions does not declare a session extension
- **WHEN** a session is signed
- **THEN** the `Poppy-Extensions` header does not declare a non-existent `session` extension
