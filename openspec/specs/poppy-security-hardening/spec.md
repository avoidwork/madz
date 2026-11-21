# poppy-security-hardening Specification

## Purpose
Lets madz enforce Poppy's security considerations: keep secrets out of model context, treat company content as data, validate audiences, and manage delegated keys and sign-in risks.

## Requirements

### Requirement: Secrets are kept out of model context
The system SHALL keep access tokens, refresh tokens, session JWTs, private keys, authorization codes, PKCE verifiers, and device codes out of model context by storing them in a secrets vault and redacting them from any content returned to the model.

#### Scenario: Secret is stored and retrieved by key
- **WHEN** a secret is stored in the vault under a logical key
- **THEN** it can be retrieved by that key without exposing the value to the model

#### Scenario: Secret is redacted from model output
- **WHEN** a payload containing a known secret value is passed through the redaction helper
- **THEN** the secret value is removed from the payload before it is returned to the model

#### Scenario: Secret is rotated
- **WHEN** a secret is rotated
- **THEN** the old value is invalidated and a new value is stored under the same key

#### Scenario: Secret is deleted
- **WHEN** a secret is deleted from the vault
- **THEN** it can no longer be retrieved by its key

### Requirement: Company content is treated as data
The system SHALL mark company content (messages, API responses, web pages, skill content, alternatives) as data rather than instructions, and neutralize instruction-like markers before the content is consumed.

#### Scenario: Company content is marked as data
- **WHEN** company content is processed by the content-trust helper
- **THEN** it is identifiable as data and not as instructions

#### Scenario: Instruction-like markers are neutralized
- **WHEN** company content contains instruction-like markers
- **THEN** those markers are neutralized so the content is not executed as instructions

#### Scenario: Serialization is unchanged
- **WHEN** company content is marked as data
- **THEN** its serialized form is unchanged

### Requirement: Audiences are validated against the company identifier
The system SHALL validate token and assertion audiences against the verified company identifier, rejecting mismatches.

#### Scenario: Matching audience is accepted
- **WHEN** a token or assertion audience matches the verified company identifier
- **THEN** validation succeeds

#### Scenario: Mismatched audience is rejected
- **WHEN** a token or assertion audience does not match the verified company identifier
- **THEN** validation fails with an error

### Requirement: Delegated keys are isolated per user
The system SHALL bind each delegated key to a single user ID, rejecting attempts to use a delegated key for a different user ID.

#### Scenario: Delegated key signs for its bound user
- **WHEN** a delegated key is used for its bound user ID
- **THEN** signing succeeds

#### Scenario: Delegated key is rejected for a different user
- **WHEN** a delegated key is used for a different user ID
- **THEN** the system returns an error

### Requirement: Delegated keys are rotated
The system SHALL support rotating a delegated key, issuing a new key and invalidating the old one.

#### Scenario: Delegated key rotation issues a new key
- **WHEN** a delegated key is rotated
- **THEN** a new key is issued for the user

#### Scenario: Old delegated key is invalidated
- **WHEN** a delegated key is rotated
- **THEN** the old key is invalidated and can no longer be used

### Requirement: Delegations are short-lived
The system SHALL issue delegations with a lifetime of at most 24 hours.

#### Scenario: Delegation lifetime is at most 24 hours
- **WHEN** a delegation is issued
- **THEN** its `exp` minus `iat` is at most 86400 seconds

### Requirement: Blind signing is supported
The system SHALL support optional blind signing (RFC 9474) for client assertions and delegations, producing signatures that verify against the corresponding public key.

#### Scenario: Blind-signed assertion verifies
- **WHEN** a client assertion is blind-signed
- **THEN** the signature verifies against the corresponding public key

#### Scenario: Blind-signed delegation verifies
- **WHEN** a delegation is blind-signed
- **THEN** the signature verifies against the corresponding public key

### Requirement: Sign-in risks are handled
The system SHALL handle sign-in risks by enforcing `prompt=consent` for cross-device flows and flagging consent-phishing indicators.

#### Scenario: Cross-device flow requires prompt=consent
- **WHEN** a cross-device flow does not include `prompt=consent`
- **THEN** the system rejects the flow

#### Scenario: Cross-device flow with prompt=consent is accepted
- **WHEN** a cross-device flow includes `prompt=consent`
- **THEN** the flow is accepted

#### Scenario: Consent-phishing indicators are flagged
- **WHEN** a consent prompt exhibits consent-phishing indicators
- **THEN** the system flags the prompt

### Requirement: Security action is exposed by the poppy tool
The system SHALL expose a `security` action on the `poppy` tool that dispatches to the security module.

#### Scenario: Security action dispatches
- **WHEN** the `poppy` tool is invoked with `action: "security"`
- **THEN** it dispatches to the security module's execute function

#### Scenario: Unknown security operation is rejected
- **WHEN** the `poppy` tool is invoked with an unknown `security` operation
- **THEN** the system returns an error
