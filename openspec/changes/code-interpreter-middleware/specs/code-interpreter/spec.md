## ADDED Requirements

### Requirement: VM executes JavaScript code
The system SHALL execute JavaScript code provided to the `eval` tool within a sandboxed QuickJS VM.

#### Scenario: Simple expression evaluation
- **WHEN** the orchestrator calls the `eval` tool with code `"1 + 1"`
- **THEN** the system returns `"2"` as the execution result

#### Scenario: Complex script with loops
- **WHEN** the orchestrator calls the `eval` tool with code containing a `for` loop that sums an array
- **THEN** the system returns the computed result as a string

#### Scenario: Async code with Promise.all
- **WHEN** the orchestrator calls the `eval` tool with async code using `Promise.all`
- **THEN** the system awaits the promise and returns the resolved result

### Requirement: VM enforces memory limits
The system SHALL enforce a configurable memory limit on VM execution, preventing out-of-memory conditions.

#### Scenario: Memory limit exceeded
- **WHEN** VM code allocates memory exceeding `memoryLimit` bytes
- **THEN** the system terminates execution and returns an error indicating memory limit exceeded

#### Scenario: Memory limit not exceeded
- **WHEN** VM code allocates memory within `memoryLimit` bytes
- **THEN** execution completes normally

### Requirement: VM enforces execution timeout
The system SHALL enforce a configurable execution timeout, terminating code that runs longer than `timeoutMs`.

#### Scenario: Execution exceeds timeout
- **WHEN** VM code runs longer than `timeoutMs` milliseconds
- **THEN** the system terminates execution and returns an error indicating timeout

#### Scenario: Execution within timeout
- **WHEN** VM code completes within `timeoutMs` milliseconds
- **THEN** execution completes normally and returns the result

### Requirement: VM sandboxed fetch
The system SHALL restrict network access within the VM to only URLs that pass the existing URL filter validation.

#### Scenario: Allowed URL fetch
- **WHEN** VM code calls `fetch()` on a URL that passes the URL filter
- **THEN** the fetch succeeds and returns the response

#### Scenario: Blocked URL fetch
- **WHEN** VM code calls `fetch()` on a URL that fails the URL filter
- **THEN** the fetch fails with an error indicating the URL is blocked

### Requirement: Eval tool exposes to orchestrator
The system SHALL expose an `eval` tool (LangChain StructuredTool) to the orchestrator agent that accepts JavaScript code and returns execution results.

#### Scenario: Eval tool accepts code string
- **WHEN** the orchestrator invokes the `eval` tool with a `code` parameter
- **THEN** the system executes the code in the VM and returns the result

#### Scenario: Eval tool rejects empty code
- **WHEN** the orchestrator invokes the `eval` tool with an empty `code` parameter
- **THEN** the system returns an error indicating the code must not be empty

### Requirement: Persistence modes
The system SHALL support three persistence modes controlling VM state lifecycle.

#### Scenario: Thread mode persists across turns
- **WHEN** `mode` is `"thread"` and the orchestrator makes multiple eval calls across turns
- **THEN** the VM state (variables, functions, objects) persists between calls

#### Scenario: Turn mode persists within a turn
- **WHEN** `mode` is `"turn"` and the orchestrator makes multiple eval calls within a single turn
- **THEN** the VM state persists between calls within the turn but is discarded after the turn

#### Scenario: Call mode creates fresh REPL
- **WHEN** `mode` is `"call"` and the orchestrator makes multiple eval calls
- **THEN** each call creates a fresh VM instance with no state from previous calls

### Requirement: PTC tool proxy
The system SHALL expose existing agent tools as JS functions callable from within the VM when `ptcEnabled` is `true`.

#### Scenario: PTC exposes whitelisted tools
- **WHEN** `ptcEnabled` is `true` and the VM code calls `tools.readFile({ path: "..." })`
- **THEN** the system executes the tool and returns the result as a string

#### Scenario: PTC blocks non-whitelisted tools
- **WHEN** `ptcEnabled` is `true` and the VM code calls `tools.nonExistentTool()`
- **THEN** the system returns an error indicating the tool is not available

#### Scenario: PTC tool errors produce readable strings
- **WHEN** a PTC tool call fails (e.g., file not found)
- **THEN** the system returns a readable error string, not a VM crash

### Requirement: Subagent dispatch proxy
The system SHALL expose the `task()` subagent dispatch as a JS function callable from within the VM when `subagentsEnabled` is `true`.

#### Scenario: Subagent dispatch from VM
- **WHEN** `subagentsEnabled` is `true` and the VM code calls `task("summarize this", { path: "..." })`
- **THEN** the system spawns a subagent and returns the result as a string

#### Scenario: Subagent dispatch error handling
- **WHEN** a subagent call fails (e.g., subagent timeout)
- **THEN** the system returns a readable error string to the VM

### Requirement: Middleware integration
The system SHALL integrate the CodeInterpreterMiddleware into the orchestrator creation flow via the deepagents middleware pattern.

#### Scenario: Middleware enabled creates eval tool
- **WHEN** `codeInterpreter.enabled` is `true` in config
- **THEN** the orchestrator receives the `eval` tool in its tool list

#### Scenario: Middleware disabled preserves existing behavior
- **WHEN** `codeInterpreter.enabled` is `false` or absent in config
- **THEN** the orchestrator behaves identically to the current implementation (no eval tool)

#### Scenario: System prompt includes eval instructions
- **WHEN** the middleware is enabled
- **THEN** the orchestrator's system prompt includes instructions about when and how to use the `eval` tool

### Requirement: Config validation
The system SHALL validate the `codeInterpreter` config section using a Zod schema with sensible defaults.

#### Scenario: Valid config passes validation
- **WHEN** the config contains valid `codeInterpreter` values
- **THEN** the config validates successfully

#### Scenario: Invalid mode is rejected
- **WHEN** the config contains `mode: "invalid"`
- **THEN** the config validation fails with a clear error message

#### Scenario: Missing config uses defaults
- **WHEN** the config does not include a `codeInterpreter` section
- **THEN** the system uses default values (enabled: false, mode: "thread", etc.)
