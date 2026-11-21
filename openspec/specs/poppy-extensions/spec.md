# poppy-extensions Specification

## Purpose
Lets madz declare and handle Poppy protocol extensions, so it can work with companies that offer optional extension features while ignoring unsupported ones.

## Requirements

### Requirement: Extensions are parsed from poppy.json
The system SHALL parse the `extensions` field from a company's `poppy.json` document, keyed by extension name with a version and endpoint per entry, and ignore unknown extensions and unsupported versions.

#### Scenario: Valid extensions are parsed
- **WHEN** a `poppy.json` document declares an `extensions` field with known extensions
- **THEN** the system parses each extension's name, version, and endpoint into a normalized structure

#### Scenario: Unknown extensions are ignored
- **WHEN** a `poppy.json` document declares an extension the system does not support
- **THEN** the system ignores that extension without error

#### Scenario: Unsupported versions are ignored
- **WHEN** a `poppy.json` document declares a supported extension with an unsupported version
- **THEN** the system ignores that version without error

### Requirement: Poppy-Extensions header is sent
The system SHALL send the `Poppy-Extensions` header as an RFC 9651 List of Strings declaring the extensions madz uses with a company, one version each.

#### Scenario: Header is emitted when extensions are declared
- **WHEN** madz declares supported extensions for a company
- **THEN** the system sends a `Poppy-Extensions` header listing each extension with one version

#### Scenario: Header is omitted when no extensions are declared
- **WHEN** madz declares no extensions for a company
- **THEN** the system omits the `Poppy-Extensions` header

### Requirement: extension_required responses are handled
The system SHALL handle `extension_required` (403) responses, surfacing the name of the required extension.

#### Scenario: Required extension is surfaced
- **WHEN** a company responds with an `extension_required` error naming a required extension
- **THEN** the system surfaces the required extension name so the caller can respond

### Requirement: Core extensions are implemented
The system SHALL implement the core extensions `browser-control`, `disclosures`, `links`, `mediated-sign-in`, `operations`, and `ucp`.

#### Scenario: Each core extension is recognized
- **WHEN** madz encounters any of the core extensions
- **THEN** the system handles it according to its extension-specific behavior

#### Scenario: Unknown extensions are ignored
- **WHEN** madz encounters an extension not in the core set
- **THEN** the system ignores it without error

### Requirement: Extension content is validated
The system SHALL validate extension content against published JSON Schemas, treating it as data rather than instructions.

#### Scenario: Invalid extension content is rejected
- **WHEN** extension content does not match its published schema
- **THEN** the system rejects the content with an error

#### Scenario: Valid extension content is accepted
- **WHEN** extension content matches its published schema
- **THEN** the system accepts the content
