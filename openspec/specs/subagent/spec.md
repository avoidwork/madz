# subagent Specification

## Purpose
TBD - created by archiving change subagent-tool. Update Purpose after archive.
## Requirements
### Requirement: Sub-agent tool spawns child processes
The subAgent tool SHALL spawn `node index.js "PROMPT" sessionsDir` as an independent child process, inheriting the parent's environment variables while maintaining session isolation.

#### Scenario: Single execution spawns process
- **WHEN** user calls subAgent with a delegation instruction and context
- **THEN** the tool spawns a node process with the constructed prompt and returns a structured result

#### Scenario: Process inherits environment
- **WHEN** a sub-agent is spawned
- **THEN** it inherits the parent process's environment variables (API keys, config paths)

### Requirement: Prompt construction with separator
The subAgent tool SHALL construct the sub-agent prompt by combining context and delegation instruction, separated by `|||`. The sub-agent recognizes this separator and treats everything after it as the delegation instruction.

#### Scenario: Prompt includes context and delegation
- **WHEN** subAgent is called with context and delegation
- **THEN** the prompt is constructed as `[context] ||| [delegation]`

#### Scenario: Prompt is shell-escaped
- **WHEN** the prompt contains quotes, backticks, dollar signs, or newlines
- **THEN** the prompt is properly escaped for shell argument passing

### Requirement: Marker-based stdout parsing
The subAgent tool SHALL parse sub-agent output by splitting stdout on the `# SubAgent` marker. If the marker is missing, the tool returns `{ ok: false, error: "..." }`.

#### Scenario: Valid marker returns result
- **WHEN** sub-agent output contains `# SubAgent` marker
- **THEN** the tool returns `{ ok: true, result: "<content after marker>" }`

#### Scenario: Missing marker returns error
- **WHEN** sub-agent output does not contain `# SubAgent` marker
- **THEN** the tool returns `{ ok: false, error: "Marker not found in output" }`

#### Scenario: Empty result after marker returns error
- **WHEN** marker is present but no content follows
- **THEN** the tool returns `{ ok: false, error: "No content after marker" }`

### Requirement: Response contract
The subAgent tool SHALL return a structured result matching the compaction tool pattern: `{ ok: boolean, result: string, error?: string }`.

#### Scenario: Successful execution
- **WHEN** sub-agent completes successfully
- **THEN** result is `{ ok: true, result: "<sub-agent output>" }`

#### Scenario: Failed execution
- **WHEN** sub-agent fails or times out
- **THEN** result is `{ ok: false, error: "<error description>" }`

### Requirement: Single execution mode
The subAgent tool SHALL support single execution mode with optional `returnParams` for JSON result filtering.

#### Scenario: Single execution without returnParams
- **WHEN** subAgent is called with delegation and context but no returnParams
- **THEN** the full sub-agent output is returned as the result

#### Scenario: Single execution with returnParams
- **WHEN** subAgent is called with returnParams `["findings", "recommendations"]`
- **THEN** the result is filtered to only include those keys from the JSON output

#### Scenario: returnParams with non-JSON output
- **WHEN** sub-agent output is not valid JSON and returnParams is specified
- **THEN** the tool falls back to returning full text

### Requirement: Fan-out mode — parallel execution
The subAgent tool SHALL support fan-out mode with parallel strategy, bounded by `maxConcurrent` limit.

#### Scenario: Parallel fan-out respects maxConcurrent
- **WHEN** subAgent is called with tasks, strategy "parallel", and maxConcurrent 3
- **THEN** at most 3 sub-agents run simultaneously; remaining tasks queue

#### Scenario: Parallel fan-out aggregates results
- **WHEN** all parallel tasks complete
- **THEN** results are combined into a single aggregated result string

#### Scenario: Parallel fan-out with continue on error
- **WHEN** a task fails and onError is "continue"
- **THEN** remaining tasks continue executing; failed task result is marked with error

#### Scenario: Parallel fan-out with fail-fast on error
- **WHEN** a task fails and onError is "fail-fast"
- **THEN** remaining queued tasks are cancelled; partial results are returned

### Requirement: Fan-out mode — sequential execution
The subAgent tool SHALL support fan-out mode with sequential strategy, running tasks one at a time.

#### Scenario: Sequential fan-out runs one at a time
- **WHEN** subAgent is called with tasks and strategy "sequential"
- **THEN** tasks execute one after another in order

#### Scenario: Sequential fan-out with continue on error
- **WHEN** a task fails and onError is "continue"
- **THEN** remaining tasks continue executing

#### Scenario: Sequential fan-out with fail-fast on error
- **WHEN** a task fails and onError is "fail-fast"
- **THEN** remaining tasks are cancelled; partial results are returned

### Requirement: Timeout enforcement
The subAgent tool SHALL enforce timeouts with priority: per-call `timeout` parameter > `config.yaml` default.

#### Scenario: Per-call timeout overrides config
- **WHEN** subAgent is called with timeout 30000 and config default is 60000
- **THEN** the sub-agent uses 30000ms timeout

#### Scenario: Config default is used when no per-call override
- **WHEN** no per-call timeout is provided and config.yaml defines process.subAgent.timeout as 600000
- **THEN** the sub-agent uses 600000ms timeout

#### Scenario: Timeout kills process
- **WHEN** sub-agent exceeds its timeout
- **THEN** the process receives SIGTERM, then SIGKILL after 5 seconds

### Requirement: Process tracking
The subAgent tool SHALL track spawned processes using the shared `processTracker` from terminal.js, enabling PID tracking, status reporting, and graceful termination.

#### Scenario: Process is tracked on spawn
- **WHEN** a sub-agent is spawned
- **THEN** it is recorded in processTracker with PID, command, status "running", and startTime

#### Scenario: Process status updates on exit
- **WHEN** a tracked sub-agent exits
- **THEN** its status is updated to "exited" (code 0) or "exited:<code>" (non-zero)

### Requirement: Session isolation modes
The subAgent tool SHALL support three session isolation modes: `isolated` (fresh session), `forked` (compaction in new session), `shared` (parent session).

#### Scenario: Isolated mode creates fresh session
- **WHEN** sessionMode is "isolated" (default)
- **THEN** the sub-agent receives a fresh, empty session

#### Scenario: Forked mode passes compaction
- **WHEN** sessionMode is "forked"
- **THEN** the sub-agent receives a compaction of the parent's context in a new short-lived session

#### Scenario: Shared mode uses parent session
- **WHEN** sessionMode is "shared"
- **THEN** the sub-agent writes to the parent's session (not recommended for fan-out)

### Requirement: Tool registration
The subAgent tool SHALL be registered in `src/tools/index.js` with `process:spawn` permission gate, following the factory pattern used by other tools.

#### Scenario: Tool registers when permission enabled
- **WHEN** `process:spawn` is in the enabled permissions set
- **THEN** the subAgent tool is included in the built tool array

#### Scenario: Tool does not register when permission disabled
- **WHEN** `process:spawn` is not in the enabled permissions set
- **THEN** the subAgent tool is excluded from the built tool array

### Requirement: Configuration
The subAgent tool SHALL be configured via `config.yaml` under `process.subAgent` with settings for timeout, maxConcurrent, sessionMode, defaultStrategy, and defaultOnError.

#### Scenario: Config section exists
- **WHEN** config.yaml is loaded
- **THEN** `process.subAgent` section contains timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError

#### Scenario: Config defaults are applied
- **WHEN** no per-call overrides are provided
- **THEN** config defaults are used for timeout, maxConcurrent, sessionMode, defaultStrategy, defaultOnError

### Requirement: Child process environment
The subAgent tool SHALL pass only necessary environment variables to child processes. No unused or dead environment variables SHALL be included in the child process environment.

#### Scenario: Child process receives necessary env vars
- **WHEN** a sub-agent is spawned
- **THEN** it inherits the parent process's environment variables (API keys, config paths) without unused variables like MADZ_SESSION_ID

#### Scenario: No dead env vars passed to child
- **WHEN** a sub-agent is spawned
- **THEN** the child process environment does not include MADZ_SESSION_ID

