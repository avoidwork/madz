## ADDED Requirements

### Requirement: Package is publishable to npm
The `madz` package MUST be publishable to npm with a `bin` field so users can install it globally via `npm install -g madz` and invoke it as the `madz` command.

#### Scenario: Package has bin field
- **WHEN** `package.json` is inspected
- **THEN** a `bin` field exists pointing to `index.js`

#### Scenario: Entry script is executable
- **WHEN** `index.js` is inspected for the first line
- **THEN** it starts with `#!/usr/bin/env node`

#### Scenario: Global install creates command
- **WHEN** a user runs `npm install -g madz`
- **THEN** a `madz` executable is available on PATH

### Requirement: Bin supports interactive TUI mode
When invoked via the `madz` command with `--mode interactive`, the package MUST launch the Ink-based terminal UI.

#### Scenario: Interactive mode via bin
- **WHEN** a user runs `madz --mode interactive`
- **THEN** the Ink TUI app renders in the terminal

### Requirement: Bin supports single-prompt chat mode
When invoked via the `madz` command without flags or with a message argument, the package MUST run in chat mode and output the response to stdout.

#### Scenario: Chat mode with message
- **WHEN** a user runs `madz "What's the CPU load?"`
- **THEN** the LLM response is printed to stdout

#### Scenario: Chat mode without message defaults to Hello
- **WHEN** a user runs `madz` with no arguments
- **THEN** it sends "Hello" as the default message and prints the response

#### Scenario: Chat mode with --session-id flag
- **WHEN** a user runs `madz "continue" --session-id abc123`
- **THEN** the existing session is restored before responding

### Requirement: Bin supports JSON output mode
When invoked via the `madz` command with `--json`, the package MUST output the response as JSON to stdout for pipeline consumption.

#### Scenario: JSON output flag
- **WHEN** a user runs `madz "Summarize memory/_index.md" --json`
- **THEN** the response is formatted as JSON to stdout

### Requirement: Runtime dependencies are declared
All runtime dependencies used by `index.js` MUST be listed in `dependencies` (not `devDependencies`) so they are installed during global npm install.

#### Scenario: All runtime deps in dependencies
- **WHEN** `package.json` dependencies are inspected
- **THEN** `ink`, `react`, `@langchain/langgraph`, `js-yaml`, and all other modules imported by `index.js` are listed in `dependencies`

### Requirement: Package publishes with correct files
When published to npm, only the necessary project files MUST be included — test files, dev dependencies, and CI config files should be excluded.

#### Scenario: Files field limits published content
- **WHEN** `package.json` has a `files` field
- **THEN** it lists only `index.js`, `src/`, `config.yaml`, `skills/`, `memory/`, and `README.md` (or equivalent minimal set)

#### Scenario: No test files in published package
- **WHEN** the published tarball is extracted
- **THEN** `tests/` directory is not present

### Requirement: Docker scripts are preserved
The existing Docker build/push/release scripts in `package.json` MUST be preserved so the Docker distribution channel continues to work.

#### Scenario: Docker scripts remain in package.json
- **WHEN** `package.json` scripts are inspected
- **THEN** `docker:build`, `docker:push`, and `docker:release` entries exist
