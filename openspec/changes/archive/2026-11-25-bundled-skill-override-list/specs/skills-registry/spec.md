# Spec Delta

## MODIFIED Requirements

### Requirement: Cross-Client Directory Scanning
The system SHALL scan multiple directory scopes for skills: project-level `skills/`, project-level `.skills/` (system skills baked into the image), and user-level `~/.agents/skills/`. When the same skill name is found in multiple scopes, `.skills/` (bundled) always takes precedence over `skills/` (user) regardless of scan order, and project-level skills override user-level skills. When the `agent.bundledSkills` master switch is `false`, the bundled `.skills/` scope SHALL load only the `reflection` skill plus any skill whose name appears in the `agent.bundledSkillOverrides` list. The `reflection` skill SHALL always be loaded and is reserved — it is never subject to the override list. The override list is purely additive and is only honored when `bundledSkills` is `false`; when `bundledSkills` is `true`, the override list has no effect. User skills in `skills/` are unaffected by the override list.

#### Scenario: Skills discovered in project-level skills directory
- **WHEN** a skill exists in `<project>/skills/<name>/SKILL.md`
- **THEN** the system discovers and registers the skill

#### Scenario: Skills discovered in .skills directory
- **WHEN** a skill exists in `<project>/.skills/<name>/SKILL.md`
- **THEN** the system discovers and registers the skill

#### Scenario: Bundled skill wins over user skill
- **WHEN** a skill named `code-review` exists in both `<project>/skills/` and `<project>/.skills/`
- **THEN** the `.skills/` system skill takes precedence and the `skills/` user skill is ignored with a logged warning

#### Scenario: Project-level skill overrides user-level
- **WHEN** a skill named `code-review` exists in both `<project>/skills/` and `~/.agents/skills/`
- **THEN** the project-level skill takes precedence and the user-level skill is shadowed with a logged warning

#### Scenario: Bundled skills disabled loads only reflection
- **WHEN** `agent.bundledSkills` is `false` and `agent.bundledSkillOverrides` is empty
- **THEN** the bundled `.skills/` scope loads only the `reflection` skill

#### Scenario: Bundled skills disabled loads reflection plus overridden skills
- **WHEN** `agent.bundledSkills` is `false` and `agent.bundledSkillOverrides` contains `commit-push`
- **THEN** the bundled `.skills/` scope loads both `reflection` and `commit-push`

#### Scenario: Override list ignored when bundled skills enabled
- **WHEN** `agent.bundledSkills` is `true` and `agent.bundledSkillOverrides` is non-empty
- **THEN** the override list has no effect and all bundled skills are loaded

#### Scenario: Reflection listed in overrides still loaded once
- **WHEN** `agent.bundledSkills` is `false` and `agent.bundledSkillOverrides` contains `reflection`
- **THEN** the `reflection` skill is loaded exactly once and remains reserved

#### Scenario: Override naming a non-existent skill has no effect
- **WHEN** `agent.bundledSkills` is `false` and `agent.bundledSkillOverrides` contains a skill name that does not exist in `.skills/`
- **THEN** only `reflection` is loaded and the unknown name is ignored
