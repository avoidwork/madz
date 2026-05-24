## ADDED Requirements

### Requirement: Skills Settings Schema
The settings schema SHALL be extended with a `skills` object containing: `autoActivate` (boolean, default `false` — whether skills are auto-triggered by the assistant based on context), `scope` (enum: `project | workspace | global`, default `"project"`), `allowlist` (array of strings — file paths or globs that override scope filtering), `maxInstructions` (number — maximum lines of skill instructions, default `500`), and `maxContextInjection` (number — maximum lines of skill context injected into LLM prompt, default `2000`).

#### Scenario: Settings load default skills schema
- **WHEN** the application starts without a `skills` config section
- **THEN** the system uses defaults: `autoActivate: false`, `scope: "project"`, `allowlist: []`, `maxInstructions: 500`, `maxContextInjection: 2000`

#### Scenario: Settings reject invalid skills scope
- **WHEN** the settings schema receives `skills.scope: "invalid"`
- **THEN** the system exits with a validation error identifying the `skills.scope` field

### Requirement: Scheduler Settings Schema
The settings schema SHALL be extended with a `scheduler` object containing: `enabled` (boolean, default `true`), `checkInterval` (number in milliseconds, default `60000`), `maxConcurrent` (number, default `3`), `overflowPolicy` (enum: `queue | skip`, default `"queue"`), `maxDurationPerSkill` (number in milliseconds, default `300000` / 5 minutes), and `logLevel` (enum: `error | warn | info | debug`, default `"info"`).

#### Scenario: Settings load default scheduler schema
- **WHEN** the application starts without a `scheduler` config section
- **THEN** the system uses defaults: `enabled: true`, `checkInterval: 60000`, `maxConcurrent: 3`, `overflowPolicy: "queue"`, `maxDurationPerSkill: 300000`, `logLevel: "info"`

#### Scenario: Settings reject invalid scheduler checkInterval
- **WHEN** the settings schema receives `scheduler.checkInterval: -100`
- **THEN** the system exits with a validation error identifying the `scheduler.checkInterval` field