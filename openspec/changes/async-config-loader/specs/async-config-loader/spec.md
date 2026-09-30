# async-config-loader Specification

## ADDED Requirements

### Requirement: Async config loading
The system SHALL load configuration from `config.yaml` using async file I/O (`readFile` and `access` from `node:fs/promises`) in `loadConfig()`, and SHALL NOT use synchronous fs operations (`readFileSync`, `existsSync`) in this async function.

#### Scenario: loadConfig reads config.yaml asynchronously
- **WHEN** `loadConfig()` is called
- **THEN** it uses `readFile` from `node:fs/promises` to read `config.yaml` instead of `readFileSync`

#### Scenario: loadConfig checks file existence asynchronously
- **WHEN** `loadConfig()` checks whether `config.yaml` exists
- **THEN** it uses `access` from `node:fs/promises` instead of `existsSync`

### Requirement: Async config saving
The system SHALL save configuration to `config.yaml` using async file I/O (`writeFile` and `mkdir` from `node:fs/promises`) in `saveConfig()`, and SHALL NOT use synchronous fs operations (`writeFileSync`, `mkdirSync`) in this async function.

#### Scenario: saveConfig writes config.yaml asynchronously
- **WHEN** `saveConfig()` is called
- **THEN** it uses `writeFile` from `node:fs/promises` to write `config.yaml` instead of `writeFileSync`

#### Scenario: saveConfig creates directory asynchronously
- **WHEN** `saveConfig()` needs to create the config directory
- **THEN** it uses `mkdir` from `node:fs/promises` instead of `mkdirSync`

### Requirement: Async config mutation
The system SHALL make `setConfigValue()` async and `await` `saveConfig()` within it.

#### Scenario: setConfigValue awaits saveConfig
- **WHEN** `setConfigValue()` is called
- **THEN** it `await`s the async `saveConfig()` before returning

### Requirement: Callers await async config functions
The system SHALL `await` `loadConfig()`, `saveConfig()`, and `setConfigValue()` wherever they are called from async contexts.

#### Scenario: Entry point awaits loadConfig
- **WHEN** `index.js` loads configuration at startup
- **THEN** it `await`s `loadConfig()`

#### Scenario: Tools await loadConfig
- **WHEN** a tool (e.g., `getConfig`) calls `loadConfig()`
- **THEN** it `await`s the async function

#### Scenario: TUI awaits setConfigValue
- **WHEN** the TUI config-mutation path calls `setConfigValue()`
- **THEN** it `await`s the async function
