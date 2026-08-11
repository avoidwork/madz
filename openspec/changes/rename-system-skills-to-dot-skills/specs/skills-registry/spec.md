## MODIFIED Requirements

### Requirement: Cross-Client Directory Scanning
The system SHALL scan multiple directory scopes for skills: project-level `skills/`, project-level `.skills/` (system skills baked into the image), and user-level `~/.agents/skills/`. When the same skill name is found in multiple scopes, `.skills/` (system) shadows `skills/` (user), and project-level skills override user-level skills.

#### Scenario: Skills discovered in project-level skills directory
- **WHEN** a skill exists in `<project>/skills/<name>/SKILL.md`
- **THEN** the system discovers and registers the skill

#### Scenario: Skills discovered in .skills directory
- **WHEN** a skill exists in `<project>/.skills/<name>/SKILL.md`
- **THEN** the system discovers and registers the skill

#### Scenario: System skill shadows user skill
- **WHEN** a skill named `code-review` exists in both `<project>/skills/` and `<project>/.skills/`
- **THEN** the `.skills/` system skill takes precedence and the `skills/` user skill is shadowed with a logged warning

#### Scenario: Project-level skill overrides user-level
- **WHEN** a skill named `code-review` exists in both `<project>/skills/` and `~/.agents/skills/`
- **THEN** the project-level skill takes precedence and the user-level skill is shadowed with a logged warning
