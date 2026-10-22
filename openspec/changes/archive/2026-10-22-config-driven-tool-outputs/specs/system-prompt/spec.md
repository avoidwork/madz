## ADDED Requirements

### Requirement: Tool output fallback directive
The `SYSTEM_PROMPT.md` SHALL include a fallback directive instructing tools to save their outputs to `memory/tools/` when a tool does not handle the concern itself.

#### Scenario: Fallback directive present
- **WHEN** `SYSTEM_PROMPT.md` is loaded
- **THEN** it contains a directive stating tool outputs should be saved to `memory/tools/` when a tool does not handle the concern itself
