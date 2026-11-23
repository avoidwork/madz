# Spec Delta

## MODIFIED Requirements

### Requirement: Blind signing is supported
The system SHALL support optional blind signing (RFC 9474) for client assertions and delegations, producing signatures that verify against the corresponding public key. Blind signing SHALL produce RSA blind signatures per RFC 9474 yielding PS384.

#### Scenario: Blind-signed assertion verifies
- **WHEN** a client assertion is blind-signed
- **THEN** the signature verifies against the corresponding public key

#### Scenario: Blind-signed delegation verifies
- **WHEN** a delegation is blind-signed
- **THEN** the signature verifies against the corresponding public key

#### Scenario: Blind signing yields PS384
- **WHEN** a value is blind-signed
- **THEN** the resulting signature is an RSA blind signature per RFC 9474 yielding PS384
