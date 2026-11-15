# Spec Delta

## Purpose

Provides rendering of mermaid and graphviz diagram specs to SVG or PNG, with sandbox allowlist enforcement on output paths.

## ADDED Requirements

### Requirement: Diagram rendering
The system SHALL render a mermaid or graphviz diagram spec to SVG or PNG output.

#### Scenario: Render a mermaid diagram to SVG
- **WHEN** a user provides a valid mermaid diagram spec and requests SVG output
- **THEN** the system produces a valid SVG document containing the rendered diagram

#### Scenario: Render a graphviz diagram to SVG
- **WHEN** a user provides a valid graphviz (DOT) diagram spec and requests SVG output
- **THEN** the system produces a valid SVG document containing the rendered diagram

#### Scenario: Render a mermaid diagram to PNG
- **WHEN** a user provides a valid mermaid diagram spec and requests PNG output
- **THEN** the system produces a valid PNG image containing the rendered diagram

#### Scenario: Render a graphviz diagram to PNG
- **WHEN** a user provides a valid graphviz (DOT) diagram spec and requests PNG output
- **THEN** the system produces a valid PNG image containing the rendered diagram

### Requirement: Input validation
The system SHALL validate all diagram tool input against a Zod schema before processing, rejecting unsupported formats, output types, and invalid input.

#### Scenario: Unsupported format is rejected
- **WHEN** a user requests a format other than mermaid or graphviz
- **THEN** the system returns an error indicating the format is unsupported

#### Scenario: Unsupported output type is rejected
- **WHEN** a user requests an output type other than svg or png
- **THEN** the system returns an error indicating the output type is unsupported

#### Scenario: Empty input is rejected
- **WHEN** a user provides an empty diagram spec
- **THEN** the system returns an error indicating the input is empty

### Requirement: Output path enforcement
The system SHALL enforce the sandbox allowlist on output paths, rejecting paths outside the allowlist.

#### Scenario: Output path outside allowlist is rejected
- **WHEN** a user provides an output path outside the sandbox allowlist
- **THEN** the system returns an access-denied error
