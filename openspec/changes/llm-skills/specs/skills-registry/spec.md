## ADDED Requirements

### Requirement: Skill Definition Format
A skill definition MUST be a single `.md` file containing YAML frontmatter and a markdown body. The frontmatter MUST define the following fields: `name` (string, unique identifier, kebab-case), `description` (string, human-readable), `scope` (enum: `project`, `workspace`, `global`), `version` (semver string), and `destructive` (boolean, default `false`). The body MUST contain the skill's instructions, which are plain-text markdown that the assistant follows during execution. Any other frontmatter fields MUST be ignored by the system.

#### Scenario: System loads a valid skill from file
- **WHEN** a `.md` file with valid YAML frontmatter and a markdown body is loaded
- **THEN** the system stores the skill with all frontmatter fields parsed and the body as instructions

#### Scenario: System rejects a skill with missing required frontmatter
- **WHEN** a skill `.md` file is missing the `name` field in frontmatter
- **THEN** the system logs a validation error and skips loading the skill

#### Scenario: System rejects a skill with an invalid scope
- **WHEN** a skill frontmatter specifies `scope: invalid`
- **THEN** the system logs a validation error and skips loading the skill

#### Scenario: System rejects invalid semantic version
- **WHEN** a skill frontmatter specifies `version: abc`
- **THEN** the system logs a validation error and skips loading the skill

### Requirement: Skill File Resolution
The system SHALL resolve skill files from up to three directories in order of precedence: `<project-root>/skills/` (scope `project`), `<workspace-dir>/skills/` (scope `workspace`), and `<config-dir>/skills/` (scope `global`). The system MUST NOT resolve skill files from outside these directories. Skill file resolution MUST be case-sensitive on file names and MUST skip files that do not end with `.md`.

#### Scenario: System resolves skills from all three directories
- **WHEN** skills exist in project, workspace, and global directories
- **THEN** the system loads all skills from each directory according to their declared `scope`

#### Scenario: System rejects out-of-directory skill resource reference
- **WHEN** a skill references a resource path outside the resolved skill directories
- **THEN** the system logs a security error and removes the invalid resource reference from the resolved skill

### Requirement: Scope Enforcement
Each loaded skill MUST be filtered by `settings.skills.scope`. If `settings.skills.scope` is `project`, only skills from `<project-root>/skills/` are available. If `settings.skills.scope` is `workspace`, skills from both project and workspace directories are available. If `settings.skills.scope` is `global`, skills from all three directories are available. A `settings.skills.allowlist` of file paths or glob patterns overrides scope enforcement: listed skills are loaded regardless of scope.

#### Scenario: Scope filter limits loaded skills
- **WHEN** `settings.skills.scope` is set to `project`
- **THEN** only skills with `scope: project` are loaded and available for use

#### Scenario: Allowlist overrides scope filter
- **WHEN** a skill is not in scope but its file path matches an entry in `settings.skills.allowlist`
- **THEN** the system loads the skill despite scope restrictions

#### Scenario: Glob patterns match skill files
- **WHEN** `settings.skills.allowlist` contains a glob pattern like `skills/*.md`
- **THEN** all `.md` files matching the glob are loaded as eligible skills

### Requirement: Skill Registry CRUD
The system SHALL provide a skills registry that supports `loadAll()` (resolves and returns all eligible skills), `get(name)` (returns a single skill or `undefined`), `list()` (returns metadata array of all loaded skills: name, description, scope, version, destructive), and `reload()` (re-reads all files from disk). The registry MUST support programmatic addition and removal of skills at runtime.

#### Scenario: Registry loads all eligible skills
- **WHEN** `loadAll()` is called at application startup
- **THEN** the registry resolves skills from eligible directories (per scope settings), validates each file, and stores it

#### Scenario: Registry returns undefined for non-existent skill
- **WHEN** `get("nonexistent-skill")` is called
- **THEN** the registry returns `undefined`

#### Scenario: Registry reloads all skills from disk
- **WHEN** `reload()` is called
- **THEN** the system re-reads all skill files from disk, re-validates, and updates the stored skills

### Requirement: Skill Context Injection
When a skill is activated, the system MUST inject the skill's full instructions into the LLM system message for every subsequent LLM call until the skill completes or is aborted. The skill instructions MUST be appended after the SOUL.md content in the system message. When the session moves past the skill (completes or aborts), the system MUST remove the skill instructions from subsequent system messages.

#### Scenario: Skill instructions are injected on activation
- **WHEN** `activateSkill(skillId)` is called and valid instructions exist
- **THEN** the instructions are prepended to the system message on all subsequent LLM calls until `deactivateSkill()` is called

#### Scenario: Skill instructions are removed on completion
- **WHEN** a skill completes (successfully or with failure)
- **THEN** the system strips the skill instructions from the system message and returns to the base SOUL.md system message

### Requirement: Skill Resource Validation
Resources referenced in a skill's frontmatter (`resources` array) MUST be absolute paths or paths relative to the skill's own directory. The system MUST resolve each resource path and verify the file exists within the sandbox's permitted directories. Invalid or non-existent resources MUST be logged as warnings and excluded from the resolved skill's resource list.

#### Scenario: Resource path within permitted directory resolves
- **WHEN** a skill references `resources: ["./readme.md"]` and the file exists
- **THEN** the resource path is resolved and included in the skill's resource list

#### Scenario: Resource path outside permitted directory is rejected
- **WHEN** a skill references `resources: ["/etc/passwd"]`
- **THEN** the system logs a warning `"resource-outside-permitted: /etc/passwd"` and excludes it from the skill's resources
