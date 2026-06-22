## ADDED Requirements

### Requirement: Sub-agent processes MUST be terminated on timeout using system timeout command
The subAgent tool SHALL use the system `timeout` command to wrap child process execution, ensuring reliable process termination when timeouts occur. The `timeout` command SHALL send SIGTERM at the timeout boundary and SIGKILL after a configurable escalation delay.

#### Scenario: Timeout triggers SIGTERM
- **WHEN** a sub-agent process exceeds its configured timeout
- **THEN** the system `timeout` command sends SIGTERM to the process
- **AND** the parent process receives exit code 124
- **AND** the result contains `ok: false` with a timeout error message

#### Scenario: SIGKILL escalation after --kill-after
- **WHEN** the process does not exit within 10 seconds of SIGTERM
- **THEN** the system `timeout` command sends SIGKILL to force termination
- **AND** the parent process receives exit code 137 (128 + SIGKILL) or 124

#### Scenario: Millisecond to second conversion
- **WHEN** a timeout is specified in milliseconds (e.g., 1500ms)
- **THEN** it is converted to seconds using `Math.ceil()` (e.g., 2s)
- **AND** the actual timeout is never less than the requested timeout

### Requirement: Exit code 124 MUST be detected and reported as timeout
The subAgent tool SHALL detect exit code 124 from the `timeout` command and map it to a structured timeout error response.

#### Scenario: Exit code 124 produces timeout error
- **WHEN** the child process exits with code 124
- **THEN** the result contains `ok: false`, empty `result`, and error message `Sub-agent timed out after <N>ms`
- **AND** the `sessionId` is included in the result

#### Scenario: Non-timeout exit codes are processed normally
- **WHEN** the child process exits with a code other than 124
- **THEN** the stdout is parsed using `parseSubAgentOutput()`
- **AND** the result follows the normal success/failure path

### Requirement: Arguments MUST be passed safely via array-based spawning
The subAgent tool SHALL pass all arguments to the `timeout` command as an array, eliminating the need for shell escaping. Arguments are passed directly to `spawn("timeout", [...])` without shell interpolation.

#### Scenario: Special characters in delegation are safe
- **WHEN** the delegation string contains quotes, backticks, dollar signs, or newlines
- **THEN** the argument is passed as a separate array element to `spawn("timeout", [...])`
- **AND** no shell escaping is required — array arguments bypass shell interpretation entirely

#### Scenario: Empty or null output is handled
- **WHEN** the sub-agent produces no output or null output
- **THEN** `parseSubAgentOutput()` returns `ok: false` with "No output" error
- **AND** the error message includes stderr content if available

### Requirement: Log files MUST be created for each sub-agent execution
The subAgent tool SHALL create a log file at `/tmp/sub-agent-<sessionId>.log` for each spawned process.

#### Scenario: Log file is created with session ID naming
- **WHEN** a sub-agent process is spawned
- **THEN** a log file is created at `/tmp/sub-agent-<sessionId>.log`
- **AND** both stdout and stderr are written to the log file
- **AND** the log file is closed when the process exits

### Requirement: Fan-out modes MUST respect timeout for all tasks
Both parallel and sequential fan-out modes SHALL apply the timeout to each individual task execution.

#### Scenario: Sequential fan-out timeout
- **WHEN** running in sequential mode with a timeout
- **THEN** each task is wrapped with the `timeout` command
- **AND** a timeout on one task does not affect other tasks (unless `onError: "fail-fast"`)

#### Scenario: Parallel fan-out timeout with semaphore
- **WHEN** running in parallel mode with `maxConcurrent` limit
- **THEN** each task is wrapped with the `timeout` command
- **AND** no more than `maxConcurrent` tasks run simultaneously
- **AND** each task independently respects its timeout