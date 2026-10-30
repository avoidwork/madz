# Spec Delta

## Purpose

The reflection tool reads session files, filters them by date window and ignore patterns, extracts user messages, and returns structured session data to callers.

## ADDED Requirements

### Requirement: Reflection tool returns structured success response
The reflection tool SHALL return a native structured object `{ ok: true, results }` on success, where `results` is an array of session objects with `sessionId`, `startedAt`, and `userMessages` fields.

#### Scenario: Successful populated result
- **WHEN** the tool processes sessions successfully and finds matching sessions
- **THEN** it returns `{ ok: true, results: [...] }` where `results` contains the matching session objects

#### Scenario: Successful empty result
- **WHEN** the tool processes sessions successfully but no sessions match the window or ignore patterns
- **THEN** it returns `{ ok: true, results: [] }`

### Requirement: Reflection tool returns structured failure response
The reflection tool SHALL return a native structured object `{ ok: false, error }` on a genuine failure, where `error` is a descriptive message.

#### Scenario: Session discovery command fails
- **WHEN** the underlying session discovery command (e.g., `find`) throws an error
- **THEN** the tool returns `{ ok: false, error: <descriptive message> }`

### Requirement: Reflection tool returns native objects, not JSON strings
The reflection tool SHALL return native JavaScript objects from `reflectionImpl` rather than `JSON.stringify`-wrapped strings, so callers can inspect the response as a structured object without parsing.

#### Scenario: Return value is a native object
- **WHEN** the tool is called and returns a result
- **THEN** the return value is a plain JavaScript object, not a string
