## ADDED Requirements

### Requirement: Application Settings
The system SHALL load application settings from a JSON/JSONC configuration file at a configurable path (default: `config.json`). The settings object MUST include: `memoryDir` (string, path to memory directory), `sandbox.enabled` (boolean, enable/disable Docker sandbox), `sandbox.tools.maxReadSize` (number, maximum file read size in bytes), `sandbox.toolkit.allowlist` (array of domain strings), `session.maxContextLines` (number, maximum context window lines), `tools` (object with settings per tool), and `log.level` (enum: `debug`, `info`, `warn`, `error`). The system MUST validate all settings against a zod schema at load time and exit with an error message if validation fails.

#### Scenario: Application loads valid config successfully
- **WHEN** the application starts with a valid `config.json` containing all required fields
- **THEN** the settings singleton is initialized and accessible throughout the application

#### Scenario: Application rejects invalid config
- **WHEN** the application starts with a `config.json` that has a `maxReadSize` value of type string instead of number
- **THEN** the application exits with a validation error identifying the specific field and expected type

#### Scenario: Settings can be loaded from a custom path
- **WHEN** the user specifies a config file path via CLI argument (e.g., `--config /path/to/config.json`)
- **THEN** the application loads settings from that path instead of the default location

### Requirement: SOUL.md Personality Configuration
The system SHALL load `SOUL.md` from the memory directory (default: `memory/SOUL.md`) at startup. The file MUST be plain-text markdown that defines the assistant's personality, tone, expertise domains, behavioral constraints, and operational guidelines. The system shall inject the SOUL.md content into every LLM prompt as a system message. The system MUST detect if SOUL.md is missing and create a secure default from the codebase.

#### Scenario: Application loads SOUL.md at startup
- **WHEN** the application starts and `SOUL.md` exists in the memory directory
- **THEN** the system reads and caches the file content for injection into every LLM prompt

#### Scenario: Application creates default SOUL.md when missing
- **WHEN** the application starts and `SOUL.md` does not exist in the memory directory
- **THEN** the system creates a default `SOUL.md` with secure opinionated defaults and loads it

#### Scenario: SOUL.md content is injected as system prompt
- **WHEN** the application sends a prompt to the LLM adapter
- **THEN** the cached SOUL.md content is included as the system message in the prompt payload

### Requirement: Secure Configuration Defaults
All settings MUST have production-safe default values. Defaults SHALL NOT include `DEBUG=true` or any setting that enables verbose logging, unrestricted network access, or privilege escalation. The `log.level` default MUST be `info` or higher (never `debug` for production). The `sandbox.enabled` default MUST be `true`. The tool allowlist default MUST be an empty array, requiring explicit user configuration before any outbound network tool execution.

#### Scenario: Security-sensitive defaults are safe
- **WHEN** the application is initialized without any config file
- **THEN** the loaded settings use `log.level: "info"`, `sandbox.enabled: true`, and an empty tool allowlist

#### Scenario: Debug mode is not enabled by default
- **WHEN** the application loads default settings
- **THEN** `log.level` is not set to `debug`; verbose debug logging is not active

### Requirement: Configuration Runtime Reload
The system SHALL support hot-reload of both `SOUL.md` and application settings without restarting the application. When the user sends the `/reload-config` command, the system shall re-read both files from disk, validate them, and apply the new configuration. If validation fails, the previous configuration is retained and the error is displayed to the user without breaking the session.

#### Scenario: Reload refreshes SOUL.md content
- **WHEN** the user edits `SOUL.md` and sends `/reload-config`
- **THEN** the system re-reads the file, validates the session is not affected, and caches the new content for subsequent LLM prompts

#### Scenario: Reload rejects invalid new config
- **WHEN** the user edits `config.json` to an invalid state and sends `/reload-config`
- **THEN** the system displays the validation error and retains the previous configuration without interrupting the session

#### Scenario: Reload applies new tool allowlist immediately
- **WHEN** the user adds a new domain to `sandbox.toolkit.allowlist` and sends `/reload-config`
- **THEN** subsequent tool requests to the newly added domain are permitted without restart

### Requirement: Configuration Structure
The system SHALL organize configuration into a hierarchical plain-text structure. The `config.json` format MUST follow this schema:
```
{
  "memoryDir": "<string>",
  "sandbox": {
    "enabled": true,
    "tools": {
      "maxReadSize": 50000
    }
  },
  "session": {
    "maxContextLines": 20000
  },
  "tools": {
    "autoApproveDestructive": false
  },
  "log": {
    "level": "info",
    "output": ["stdout", "file"]
  },
  "llm": {
    "endpoint": "<string>",
    "model": "<string>"
  }
}
```
The system MUST provide a `--init-config` CLI flag that generates a sample config file at the default location with all defaults and comments.

#### Scenario: --init-config creates a sample configuration
- **WHEN** the user runs `node bin/madz.mjs --init-config`
- **THEN** the application writes a `config.json` with all default values, field descriptions as comments, and secure opinions as defaults

#### Scenario: Config schema is complete
- **WHEN** the application validates the config schema
- **THEN** all fields shown in the schema structure above are recognized and validated
