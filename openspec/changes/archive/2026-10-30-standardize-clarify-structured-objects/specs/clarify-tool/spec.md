# Spec Delta

## MODIFIED Requirements

### Requirement: Clarify tool interrupts the agent to surface the question
The `clarify` tool SHALL pause the agent via LangGraph's `interrupt()` so the question (and any choices) is surfaced to the user, and SHALL return the user's answer as the `answer` field once the graph is resumed with `Command({ resume })`.

#### Scenario: Agent pauses to ask a question
- **WHEN** the `clarify` tool is invoked with a `question`
- **THEN** the agent is paused and the stream yields an `__interrupt__` value carrying the `question` (and `choices` when provided)

#### Scenario: Resume returns the user's answer
- **WHEN** the paused graph is resumed with `Command({ resume: <answer> })`
- **THEN** the `clarify` tool returns a native structured object with `ok` set to `true`, `answered` set to `true`, and `answer` equal to the resumed value

## ADDED Requirements

### Requirement: Clarify tool returns a native structured object on success
The `clarify` tool SHALL return a native structured object (not a `JSON.stringify`-wrapped string) on success, with an `ok` field set to `true` and the existing `answered`, `question`, `answer`, and `source` fields preserved.

#### Scenario: Success returns a native object with ok true
- **WHEN** the `clarify` tool completes successfully
- **THEN** the returned value is a native object with `ok` equal to `true`, `answered` equal to `true`, and the `question`, `answer`, and `source` fields present

#### Scenario: Success with choices preserves the choices field
- **WHEN** the `clarify` tool is invoked with a non-empty `choices` array and completes successfully
- **THEN** the returned native object includes a `choices` field equal to the input choices

### Requirement: Clarify tool returns a native structured object on failure
The `clarify` tool SHALL return a native structured object with `ok` set to `false` and an `error` field on failure, rather than throwing or returning a string.

#### Scenario: Failure returns a native object with ok false
- **WHEN** the `clarify` tool encounters an error
- **THEN** the returned value is a native object with `ok` equal to `false` and an `error` field describing the failure
