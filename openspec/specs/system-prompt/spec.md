# system-prompt Specification

## Purpose
TBD - created by archiving change prioritize-profile-ephemeral-context. Update Purpose after archive.
## Requirements
### Requirement: Context appended to system prompt
The `loadSystemPrompt` function in `src/memory/prompts.js` SHALL call `loadContext()` and append the resulting context string to the end of `SYSTEM_PROMPT.md` when building the system prompt.

#### Scenario: Context is appended to system prompt
- **WHEN** `loadSystemPrompt` is called to build the system prompt
- **THEN** the function loads `SYSTEM_PROMPT.md` and appends the output of `loadContext()` to it

#### Scenario: Context appended after existing prompt content
- **WHEN** `loadSystemPrompt` appends context to `SYSTEM_PROMPT.md`
- **THEN** the context appears after the existing `SYSTEM_PROMPT.md` content, not before

#### Scenario: Empty context handled gracefully
- **WHEN** `loadContext` returns an empty string (no memory files)
- **THEN** `loadSystemPrompt` returns the `SYSTEM_PROMPT.md` content unchanged without error

