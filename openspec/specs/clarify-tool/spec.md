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

### Requirement: Clarify tool interrupts the agent to surface the question
The `clarify` tool SHALL pause the agent via LangGraph's `interrupt()` so the question (and any choices) is surfaced to the user, and SHALL return the user's answer as the `answer` field once the graph is resumed with `Command({ resume })`.

#### Scenario: Agent pauses to ask a question
- **WHEN** the `clarify` tool is invoked with a `question`
- **THEN** the agent is paused and the stream yields an `__interrupt__` value carrying the `question` (and `choices` when provided)

#### Scenario: Resume returns the user's answer
- **WHEN** the paused graph is resumed with `Command({ resume: <answer> })`
- **THEN** the `clarify` tool returns a JSON object with `answered` set to `true` and `answer` equal to the resumed value

### Requirement: Clarify tool description notes the interrupt behavior
The `clarify` tool `description` SHALL note that it interrupts the agent to surface the question and captures the user's reply.

#### Scenario: Description reflects interrupt behavior
- **WHEN** the `clarify` tool is registered
- **THEN** its `description` mentions that it interrupts the agent to surface the question and captures the user's reply

### Requirement: Clarify tool description references memory/tools
The `clarify` tool `description` SHALL reference `memory/tools/` as the location where clarification questions are stored for session context.

#### Scenario: Description references tools directory
- **WHEN** the `clarify` tool is registered
- **THEN** its `description` mentions `memory/tools/` as the storage location for clarification questions

