# Spec Delta

## MODIFIED Requirements

### Requirement: Poppy-Extensions header is sent
The system SHALL send the `Poppy-Extensions` header as an RFC 9651 List of Strings declaring the extensions madz uses with a company, one version each. Each extension SHALL be emitted with its version as a `v` parameter.

#### Scenario: Header is emitted when extensions are declared
- **WHEN** madz declares supported extensions for a company
- **THEN** the system sends a `Poppy-Extensions` header listing each extension with one version

#### Scenario: Header is omitted when no extensions are declared
- **WHEN** madz declares no extensions for a company
- **THEN** the system omits the `Poppy-Extensions` header

#### Scenario: Header uses v parameter for version
- **WHEN** the `Poppy-Extensions` header is emitted
- **THEN** each extension is emitted with its version as a `v` parameter, e.g. `"operations";v="1.0"`
