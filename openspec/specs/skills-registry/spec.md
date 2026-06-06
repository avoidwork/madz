## Requirements

### Requirement: SKILL.md Frontmatter Discovery
The system SHALL automatically discover all skills by scanning for subdirectories containing a `SKILL.md` file. Metadata is extracted from the YAML frontmatter between `---` delimiters at the top of the file.
Required frontmatter fields: `name` (mandatory) and `description` (mandatory).
Optional fields: `license`, `compatibility` (max 500 chars), `metadata` (string-to-string map), `allowed-tools`, `disabled`.

#### Scenario: System discovers a SKILL.md with valid frontmatter
- **WHEN** a subdirectory of the skills scan path contains a `SKILL.md` with valid YAML frontmatter containing name and description
- **THEN** the registry registers the skill with the extracted metadata and makes it available for activation

#### Scenario: System discovers a SKILL.md without description
- **WHEN** a `SKILL.md` exists but its frontmatter lacks a non-empty description field
- **THEN** the system skips the skill and logs a warning

#### Scenario: System discovers a SKILL.md without YAML frontmatter
- **WHEN** a `SKILL.md` exists but has no YAML frontmatter between `---` delimiters
- **THEN** the system skips the skill and logs a warning

### Requirement: Name Validation
The system SHALL validate skill names against Agent Skills specification constraints: 1-64 characters, only lowercase ASCII alphanumeric characters and hyphens, no consecutive hyphens, must not start or end with a hyphen, must match the parent directory name.

#### Scenario: Valid name is accepted
- **WHEN** a skill name contains only lowercase alphanumeric characters and hyphens, is 1-64 characters, does not start or end with a hyphen, has no consecutive hyphens, and matches its parent directory name
- **THEN** the system accepts the name without warnings

#### Scenario: Name exceeds 64 characters
- **WHEN** a skill name exceeds 64 characters
- **THEN** the system logs a warning but still loads the skill (lenient validation)

#### Scenario: Name contains uppercase characters
- **WHEN** a skill name contains uppercase letters
- **THEN** the system logs a warning but still loads the skill (lenient validation)

#### Scenario: Name does not match parent directory
- **WHEN** the frontmatter `name` field does not match the parent directory name
- **THEN** the system logs a warning but still loads the skill (lenient validation)

#### Scenario: Name starts with hyphen
- **WHEN** a skill name starts with a hyphen
- **THEN** the system logs a warning but still loads the skill (lenient validation)

### Requirement: Description Validation
The system SHALL validate that descriptions are between 1 and 1024 characters and are non-empty. Empty or missing descriptions cause the skill to be skipped entirely.

#### Scenario: Valid description is accepted
- **WHEN** a description is present, non-empty, and 1-1024 characters
- **THEN** the system accepts the description without warnings

#### Scenario: Empty description is rejected
- **WHEN** a skill frontmatter has an empty or missing description field
- **THEN** the system skips the skill and logs an error

### Requirement: Progressive Disclosure
The system SHALL implement progressive disclosure for skill activation in three tiers: (1) load only `name` and `description` at startup into a catalog, (2) inject the catalog into the system prompt so the model can decide relevance, (3) the model loads the full `SKILL.md` body via its file-read tool when a task matches a skill's description.

#### Scenario: Catalog loaded at startup
- **WHEN** the system starts and discovers skills
- **THEN** only `name`, `description`, and `location` are loaded into the catalog — the full `SKILL.md` body is not loaded

#### Scenario: Model reads SKILL.md on activation
- **WHEN** the model determines a task matches a skill's description from the catalog
- **THEN** the model uses its file-read tool to load the `SKILL.md` at the catalog's location

#### Scenario: Multiple skills loaded simultaneously
- **WHEN** a task requires multiple skills
- **THEN** the model loads only the relevant SKILL.md files — unused skills remain at catalog level

### Requirement: Cross-Client Directory Scanning
The system SHALL scan multiple directory scopes for skills: project-level `skills/`, project-level `.agents/skills/`, user-level `~/.agents/skills/`, and any configured paths. When the same skill name is found in multiple scopes, project-level skills override user-level skills.

#### Scenario: Skills discovered in project-level skills directory
- **WHEN** a skill exists in `<project>/skills/<name>/SKILL.md`
- **THEN** the system discovers and registers the skill

#### Scenario: Skills discovered in .agents/skills directory
- **WHEN** a skill exists in `<project>/.agents/skills/<name>/SKILL.md` or `~/.agents/skills/<name>/SKILL.md`
- **THEN** the system discovers and registers the skill

#### Scenario: Project-level skill overrides user-level
- **WHEN** a skill named `code-review` exists in both `<project>/skills/` and `~/.agents/skills/`
- **THEN** the project-level skill takes precedence and the user-level skill is shadowed with a logged warning

### Requirement: SKILL.md Script Execution
The system SHALL execute `SKILL.md` scripts using `child_process.spawn` (not `fork`) to support non-Node.js scripts. The interpreter is detected by file extension and shebang line. Scripts in `scripts/` directories are resolved relative to the skill's base directory.

#### Scenario: Node.js script execution
- **WHEN** a skill references a `.js` script in its `scripts/` directory
- **THEN** the system executes it with Node.js, passing `--max-old-space-size` based on the configuration memory limit

#### Scenario: Python script execution
- **WHEN** a skill references a `.py` script in its `scripts/` directory
- **THEN** the system executes it with `python3`

#### Scenario: Bash script execution
- **WHEN** a skill references a `.sh` script in its `scripts/` directory
- **THEN** the system executes it with `bash`

#### Scenario: Script resolved relative to skill directory
- **WHEN** a skill's SKILL.md references `scripts/extract.py`
- **THEN** the system resolves the path as `<skill_directory>/scripts/extract.py`

### Requirement: Lenient YAML Parsing
The system SHALL parse YAML frontmatter from `SKILL.md` with lenient error handling. If initial YAML parsing fails, the system retries by wrapping values containing unquoted colons in double quotes. Skills with completely unparseable YAML are skipped with a logged error.

#### Scenario: Normal YAML parses correctly
- **WHEN** a SKILL.md frontmatter contains valid YAML
- **THEN** the system parses the frontmatter successfully

#### Scenario: YAML with unquoted colons retries
- **WHEN** a SKILL.md frontmatter contains unquoted colons like `description: Use when: the user asks about PDFs`
- **THEN** the system retries parsing with quoted values and loads the skill

#### Scenario: Completely unparseable YAML is skipped
- **WHEN** a SKILL.md frontmatter cannot be parsed even after lenient retry
- **THEN** the system skips the skill and logs an error

### Requirement: Permission Scoping
Each registered skill SHALL declare the permission scopes it requires, and the harness SHALL enforce these scopes during execution. Permission scopes now map to sandbox resource rules resolved through the capability enforcement system. The `filesystem:exec` permission scope grants read and execute access (previously only execute).

#### Scenario: Skill declares required permissions
- **WHEN** a skill's `SKILL.md` frontmatter specifies a `permissions` array
- **THEN** the system grants those scopes to the sandbox during execution

#### Scenario: Skill runs without declared permissions
- **WHEN** a skill does not declare permissions in its frontmatter
- **THEN** the system grants only the default read-only filesystem and env:read scopes
