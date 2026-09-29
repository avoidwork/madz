## MODIFIED Requirements

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

#### Scenario: loadConfig uses async fs
- **WHEN** `loadConfig()` in `src/config/loader.js` reads `config.yaml`
- **THEN** it uses `readFile` from `node:fs/promises` instead of `readFileSync`

#### Scenario: saveConfig uses async fs
- **WHEN** `saveConfig()` in `src/config/loader.js` writes `config.yaml`
- **THEN** it uses `writeFile` from `node:fs/promises` instead of `writeFileSync`

#### Scenario: Module-level sync fs preserved
- **WHEN** `logger.js` performs module-level initialization
- **THEN** synchronous fs operations are preserved (they are not called from async contexts during initialization)
