# async-fs Specification

## Purpose
TBD - created by archiving change replace-sync-fs-calls-and-silent-catches. Update Purpose after archive.
## Requirements
### Requirement: Async fs operations in async contexts
The system SHALL use `node:fs/promises` for all fs operations (`readFile`, `writeFile`, `readdir`, `stat`, `access`, `mkdir`, `unlink`) in functions that are async or called from async contexts. Synchronous fs operations (`readFileSync`, `writeFileSync`, `readdirSync`, `statSync`, `existsSync`, `mkdirSync`, `unlinkSync`) are prohibited in async contexts per AGENTS.md §1.1.

#### Scenario: loadContext uses async fs
- **WHEN** `loadContext()` in `src/memory/context.js` reads context files
- **THEN** it uses `readFile` and `readdir` from `node:fs/promises` instead of `readFileSync` and `readdirSync`

#### Scenario: loadSystemPrompt uses async fs
- **WHEN** `loadSystemPrompt()` in `src/memory/prompts.js` reads the system prompt file
- **THEN** it uses `readFile` from `node:fs/promises` instead of `readFileSync`

#### Scenario: getSkillBody uses async fs
- **WHEN** `getSkillBody()` in `src/skills/registry.js` reads a skill's SKILL.md body
- **THEN** it uses `readFile` from `node:fs/promises` instead of `readFileSync`

#### Scenario: Module-level sync fs preserved
- **WHEN** `config/loader.js` or `logger.js` perform module-level initialization
- **THEN** synchronous fs operations are preserved (they are not called from async contexts during initialization)

### Requirement: No blocking fs in async call chains
The system SHALL ensure that no file in the async call chain uses blocking fs operations. If a function is called from an async context, all fs operations within it and its transitive callees must be async.

#### Scenario: detectShebang uses async fs
- **WHEN** `detectShebang()` in `src/sandbox/runner.js` reads a script's first line
- **THEN** it uses `readFile` and `access` from `node:fs/promises` instead of `readFileSync` and `existsSync`

#### Scenario: discoverSkills uses async fs
- **WHEN** `discoverSkills()` in `src/skills/discoverer.js` scans skill directories
- **THEN** it uses `readdir`, `stat`, `readFile`, and `access` from `node:fs/promises` instead of sync equivalents

#### Scenario: loadSession uses async fs
- **WHEN** `loadSession()` in `src/session/loader.js` reads session files
- **THEN** it uses `readFile`, `readdir`, and `stat` from `node:fs/promises` instead of sync equivalents

