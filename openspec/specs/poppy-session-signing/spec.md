# poppy-session-signing Specification

## Purpose
Lets madz generate and sign Poppy-Session JWTs with delegated keys, issue delegations, and emit the associated Poppy headers so it can identify the agent, a pseudonymous user, and a session on every request to a company.

## Requirements

### Requirement: Session JWT is generated per request
The system SHALL generate a Session JWT per request with `typ: poppy-session+jwt`, `alg: ES256`, and claims `iss` (client_id), `aud` (company identifier), `sid` (random, unguessable session ID), `sub` (user ID), optional `agent_id`, `htm`/`htu` (method and URL), `iat`, `jti`, and `ath` (SHA-256 hash of access token when present).

#### Scenario: Session JWT includes required claims
- **WHEN** a Session JWT is generated for a request
- **THEN** it includes `iss`, `aud`, `sid`, `sub`, `htm`, `htu`, `iat`, and `jti`, with `typ: poppy-session+jwt` and `alg: ES256`

#### Scenario: Session JWT includes optional agent_id
- **WHEN** a Session JWT is generated with an `agent_id`
- **THEN** it includes the `agent_id` claim

#### Scenario: Session JWT omits agent_id when absent
- **WHEN** a Session JWT is generated without an `agent_id`
- **THEN** it does not include the `agent_id` claim

#### Scenario: Session JWT includes ath when access token present
- **WHEN** a Session JWT is generated with an access token
- **THEN** it includes `ath` as the SHA-256 hash of the access token

#### Scenario: Session JWT omits ath when access token absent
- **WHEN** a Session JWT is generated without an access token
- **THEN** it does not include the `ath` claim

#### Scenario: Session JWT sid is unique
- **WHEN** multiple Session JWTs are generated
- **THEN** each has a unique `sid`

#### Scenario: Session JWT jti is unique
- **WHEN** multiple Session JWTs are generated
- **THEN** each has a unique `jti`

### Requirement: Session JWT is signed with a delegated key
The system SHALL sign the Session JWT with a delegated key, carrying the delegation in the `poppy_dlg` protected header.

#### Scenario: Session JWT carries poppy_dlg header
- **WHEN** a Session JWT is signed with a delegated key
- **THEN** its protected header includes `poppy_dlg` naming the delegation

#### Scenario: Session JWT verifies against delegated key
- **WHEN** a Session JWT is signed with a delegated key
- **THEN** the signature verifies against that delegated key

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

### Requirement: Delegated keys are isolated per user
The system SHALL use each delegated key for one user ID only, rejecting attempts to use a delegated key for a different user ID.

#### Scenario: Delegated key signs for its bound user
- **WHEN** a delegated key is used to sign a session for its bound user ID
- **THEN** signing succeeds

#### Scenario: Delegated key is rejected for a different user
- **WHEN** a delegated key is used to sign a session for a different user ID
- **THEN** the system returns an error

### Requirement: Poppy headers are emitted
The system SHALL emit the `Poppy-Version` and `Poppy-Extensions` headers alongside the session header. The `Poppy-Extensions` header SHALL NOT declare a non-existent `session` extension.

#### Scenario: Poppy headers accompany session header
- **WHEN** a session is signed
- **THEN** the result includes `Poppy-Session`, `Poppy-Version`, and `Poppy-Extensions` header values

#### Scenario: Poppy-Extensions does not declare a session extension
- **WHEN** a session is signed
- **THEN** the `Poppy-Extensions` header does not declare a non-existent `session` extension

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
