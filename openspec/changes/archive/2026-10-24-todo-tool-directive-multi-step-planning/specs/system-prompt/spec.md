## ADDED Requirements

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
