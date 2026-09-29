## ADDED Requirements

### Requirement: Config loader uses async file I/O
The system SHALL use `readFile` and `writeFile` from `node:fs/promises` for all filesystem operations in `src/config/loader.js`. Synchronous fs operations (`readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`) are prohibited in `loadConfig()`, `saveConfig()`, and `setConfigValue()` per AGENTS.md §1.1.

#### Scenario: loadConfig reads config.yaml asynchronously
- **WHEN** `loadConfig()` in `src/config/loader.js` reads `config.yaml`
- **THEN** it uses `readFile` from `node:fs/promises` instead of `readFileSync`, and returns a Promise resolving to the validated config object

#### Scenario: loadConfig handles missing config file asynchronously
- **WHEN** `config.yaml` does not exist and `loadConfig()` is called
- **THEN** it catches the `ENOENT` error from `readFile` and proceeds with defaults instead of throwing

#### Scenario: saveConfig writes config.yaml asynchronously
- **WHEN** `saveConfig()` in `src/config/loader.js` writes `config.yaml`
- **THEN** it uses `writeFile` from `node:fs/promises` instead of `writeFileSync`, and returns a Promise

#### Scenario: saveConfig creates the config directory asynchronously
- **WHEN** `saveConfig()` needs to create the config directory
- **THEN** it uses `mkdir(dir, { recursive: true })` from `node:fs/promises` instead of `existsSync` + `mkdirSync`

#### Scenario: setConfigValue persists asynchronously
- **WHEN** `setConfigValue()` in `src/config/loader.js` mutates and persists config
- **THEN** it `await`s `saveConfig()` and returns a Promise

#### Scenario: loadConfig caches the in-flight promise
- **WHEN** `loadConfig()` is called concurrently before the cache is populated
- **THEN** it returns the same in-flight Promise so the file is read only once
