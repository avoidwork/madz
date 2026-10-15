# clarify-tool Specification

## Purpose
TBD - created by archiving change clarify-echo-question. Update Purpose after archive.
## Requirements
### Requirement: Clarify tool echoes the question back
The `clarify` tool SHALL echo the clarification question back in its return value so the user sees what was asked.

#### Scenario: Open-ended question is echoed
- **WHEN** the `clarify` tool is invoked with a `question` and no `choices`
- **THEN** the returned JSON includes a `question` field equal to the input question, and a `source` of `open_ended`

#### Scenario: Question with choices is echoed
- **WHEN** the `clarify` tool is invoked with a `question` and a non-empty `choices` array
- **THEN** the returned JSON includes a `question` field equal to the input question and a `choices` field equal to the input choices, and a `source` of `choices`

### Requirement: Clarify tool description notes the question is echoed
The `clarify` tool `description` SHALL note that the question is echoed back in the result.

#### Scenario: Description reflects echo behavior
- **WHEN** the `clarify` tool is registered
- **THEN** its `description` mentions that the question is echoed back in the result

