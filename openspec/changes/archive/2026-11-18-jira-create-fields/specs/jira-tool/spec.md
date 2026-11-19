# Spec Delta

## ADDED Requirements

### Requirement: Create an issue with components, labels, priority, and arbitrary fields
The system SHALL allow the `create` action to set issue components, labels, priority, and any additional Jira field (including the epic link via its custom-field ID) at creation time, merging them into the request body alongside the existing project, issue type, summary, description, and assignee.

#### Scenario: Create an issue with components, labels, and priority
- **WHEN** a user creates an issue and provides `components`, `labels`, and `priority`
- **THEN** the system sends them in the request body as `components` (array of `{ name }`), `labels` (array of strings), and `priority` (`{ name }`)

#### Scenario: Create an issue with arbitrary fields
- **WHEN** a user creates an issue and provides a `fields` record containing a custom field (e.g. the epic link `customfield_10014`)
- **THEN** the system merges those fields into the request body so the custom field is set

#### Scenario: Typed inputs take precedence over generic fields
- **WHEN** a user provides both a typed input (e.g. `priority`) and the same field in the generic `fields` record
- **THEN** the typed input value is used for that field
