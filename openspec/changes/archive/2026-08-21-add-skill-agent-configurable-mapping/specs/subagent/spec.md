## MODIFIED Requirements

### Requirement: Sub-agent tool spawns child processes
The subAgent tool SHALL spawn `node index.js "PROMPT" sessionsDir` as an independent child process, inheriting the parent's environment variables while maintaining session isolation. Skills assigned to sub-agents via `metadata.agent` (either from frontmatter or `skillAgentMap` config) SHALL be loaded and passed to the sub-agent's context.

#### Scenario: Single execution spawns process
- **WHEN** user calls subAgent with a delegation instruction and context
- **THEN** the tool spawns a node process with the constructed prompt and returns a structured result

#### Scenario: Process inherits environment
- **WHEN** a sub-agent is spawned
- **THEN** it inherits the parent process's environment variables (API keys, config paths)

#### Scenario: Sub-agent receives skills with injected metadata.agent
- **WHEN** a skill is assigned to a sub-agent via `skillAgentMap` config pattern
- **THEN** the skill's `metadata.agent` is injected before routing and the sub-agent receives the skill in its context

### Requirement: Response contract
The subAgent tool SHALL return a structured result matching the compaction tool pattern: `{ ok: boolean, result: string, error?: string }`.

#### Scenario: Successful execution
- **WHEN** sub-agent completes successfully
- **THEN** result is `{ ok: true, result: "<sub-agent output>" }`

#### Scenario: Failed execution
- **WHEN** sub-agent fails or times out
- **THEN** result is `{ ok: false, error: "<error description>" }`