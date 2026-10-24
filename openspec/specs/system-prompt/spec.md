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

### Requirement: Decision tool instruction injected when enabled
The `loadSystemPrompt` function in `src/memory/prompts.js` SHALL conditionally inject a decision tool instruction block into the system prompt based on `agent.decision.baseUrl`.

#### Scenario: Instruction injected when baseUrl configured
- **WHEN** `agent.decision.baseUrl` is a non-empty string
- **THEN** `loadSystemPrompt` SHALL replace the `<!-- DECISION_TOOL_INSTRUCTION -->` token in `SYSTEM_PROMPT.md` with the decision tool instruction block

#### Scenario: Instruction omitted when baseUrl empty
- **WHEN** `agent.decision.baseUrl` is an empty string or unset
- **THEN** `loadSystemPrompt` SHALL remove the `<!-- DECISION_TOOL_INSTRUCTION -->` token, leaving no instruction text and no token in the returned prompt

#### Scenario: Instruction is a standalone unnumbered block
- **WHEN** the decision tool instruction is injected
- **THEN** it SHALL appear as a standalone, unnumbered block near the top of the prompt, and SHALL NOT be part of a numbered directive list

### Requirement: Tool output fallback directive
The `SYSTEM_PROMPT.md` SHALL include a fallback directive instructing tools to save their outputs to `memory/tools/` when a tool does not handle the concern itself.

#### Scenario: Fallback directive present
- **WHEN** `SYSTEM_PROMPT.md` is loaded
- **THEN** it contains a directive stating tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself

### Requirement: Todo tool directive for multi-step work planning
The `SYSTEM_PROMPT.md` SHALL include a directive instructing the agent to use the `todo` tool for planning multi-step work and chained skills execution, with the following lifecycle semantics:
- When starting new work, the agent SHALL clear the todo list (`todo clear` with `confirm: true`) before creating new items.
- When continuing chained work, the agent SHALL add new items without clearing, so the overall work state is maintained.
- When all work is done, the agent SHALL clear the todo list.

#### Scenario: Directive present in system prompt
- **WHEN** `SYSTEM_PROMPT.md` is loaded
- **THEN** it contains a directive instructing the agent to use the `todo` tool for planning multi-step work and chained skills execution

#### Scenario: Directive specifies clear-on-new-work
- **WHEN** the directive is read
- **THEN** it instructs the agent to clear the todo list (`todo clear` with `confirm: true`) when starting new work

#### Scenario: Directive specifies append-on-chained-work
- **WHEN** the directive is read
- **THEN** it instructs the agent to add new items without clearing when continuing chained work, so the overall work state is maintained

#### Scenario: Directive specifies clear-on-completion
- **WHEN** the directive is read
- **THEN** it instructs the agent to clear the todo list when all work is done

