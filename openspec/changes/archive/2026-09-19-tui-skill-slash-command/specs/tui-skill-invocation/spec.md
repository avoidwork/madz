## ADDED Requirements

### Requirement: Skill slash-command invokes skill through deepagents system
The system SHALL route `/skill-name` slash commands through the deepagents skill system, synthesizing the `Run the <skill> skill [args]` prompt and dispatching it through the normal chat path, rather than loading the SKILL.md body and feeding it to the model as a plain chat prompt.

#### Scenario: User invokes a known skill via slash command
- **WHEN** the user types `/audit-code` in the TUI input
- **THEN** the system synthesizes the prompt `Run the audit-code skill` and dispatches it through the normal chat path, which routes through the deepagents orchestrator that has the skill attached

#### Scenario: User invokes a skill with arguments
- **WHEN** the user types `/audit-code src` in the TUI input
- **THEN** the system synthesizes the prompt `Run the audit-code skill src` and dispatches it through the normal chat path

#### Scenario: User invokes an unknown skill
- **WHEN** the user types `/nonexistent-skill` and the skill is not in the skill list
- **THEN** the system returns an unknown-command result indicating the command is not recognized

### Requirement: Legacy skill dispatch path removed
The system SHALL NOT load the SKILL.md body and feed it to the model as a plain chat prompt via the legacy IPC dispatch path.

#### Scenario: Skill invocation does not dump SKILL.md body
- **WHEN** the user invokes a skill via slash command
- **THEN** the system does NOT call `registry.getSkillBody()` to load the SKILL.md body and does NOT feed it to the model as a chat prompt

#### Scenario: No `_executeSkill` handler in conversation area
- **WHEN** the conversation area handles a command
- **THEN** the `_executeSkill` handler and the `subAction === "load"` dispatch branch are not present in the code path
