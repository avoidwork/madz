## MODIFIED Requirements

### Requirement: Skill tool is used for skill loading

The system SHALL direct the agent to the `skill` tool when a skill matches, rather than instructing it to `read_file` the SKILL.md path. The skill-loading prompt injected into the system message SHALL reference the `skill` tool and SHALL NOT instruct the agent to `read_file` the skill's SKILL.md.

#### Scenario: Skill-loading prompt directs the agent to the skill tool

- **WHEN** the agent is constructed with skills configured
- **THEN** the injected skill-loading prompt references the `skill` tool and does not instruct the agent to `read_file` the SKILL.md path

#### Scenario: Skill-loading prompt lists skills from the registry

- **WHEN** the agent is constructed with skills configured
- **THEN** the injected prompt lists the discovered skills (name + description) from the skill registry

#### Scenario: Replacement middleware displaces the library default

- **WHEN** the orchestrator is built
- **THEN** the middleware named `SkillsMiddleware` is the madz-owned replacement, not the library's auto-created instance
