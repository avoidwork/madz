## ADDED Requirements

### Requirement: Tool Registry
The system SHALL provide a modular tool registry that stores, validates, and dispatches tool definitions. Each tool MUST expose a name, description, zod input schema, execution function, and a `destructive` boolean flag. The registry SHALL support programmatic registration, listing, and dynamic addition/removal of tools at runtime.

#### Scenario: Registry loads a tool from definition
- **WHEN** a tool definition object with valid fields (name, description, schemaFn, execute, destructive) is registered
- **THEN** the registry stores the tool and makes it available for dispatch

#### Scenario: Registry rejects incomplete tool definition
- **WHEN** a tool definition missing the `execute` function is registered
- **THEN** the registry throws an error and does not store the tool

#### Scenario: Registry lists all available tools
- **WHEN** the application queries the registry (e.g., for display)
- **THEN** the registry returns an array of tool metadata objects (name, description, destructive flag) without executing them

### Requirement: Input Validation
Every tool invocation SHALL validate its input arguments against the tool's zod schema before execution. Tools MUST reject inputs that fail schema validation with a structured error (field name, expected type, actual value). The system MUST NOT log PII in validation errors — fields containing passwords, tokens, or credit card patterns SHALL be redacted before error output.

#### Scenario: Valid input passes validation
- **WHEN** a tool receives input that conforms to its zod schema
- **THEN** the application proceeds to tool execution with the validated input

#### Scenario: Invalid input is rejected with field error
- **WHEN** a tool receives input with a missing required field
- **THEN** the application returns a validation error identifying the field name without executing the tool

#### Scenario: PII is redacted in validation errors
- **WHEN** a validation error concerns a field containing a password or API key
- **THEN** the error output redacts the field value and displays `[REDACTED]` instead

### Requirement: URL Allowlisting
Tools that access external resources (HTTP/S requests, web fetch) MUST validate the target URL against an allowlist defined in the system configuration. The system SHALL reject access to URLs matching `file://`, `gopher://`, or `dict://` schemes regardless of the allowlist. Requests to domains not on the allowlist SHALL fail with an explicit deny error.

#### Scenario: Request to allowlisted domain succeeds
- **WHEN** a tool fetches from a URL whose domain is in the allowlist
- **THEN** the request proceeds normally

#### Scenario: Request to non-allowlisted domain is denied
- **WHEN** a tool fetches from a URL whose domain is not on the allowlist
- **THEN** the tool returns a structured error: `{ error: "domain-not-allowed", domain: "<domain>" }`

#### Scenario: Request to file:// scheme is blocked
- **WHEN** a tool fetches from a `file://` URL
- **THEN** the tool returns a structured error: `{ error: "scheme-not-allowed", scheme: "file" }`

### Requirement: Approval Gates for Destructive Operations
Before executing a tool with `destructive: true`, the system SHALL present the operation details to the user and await explicit approval. The approval prompt MUST display the tool name, target resource, and a summary of the intended action. If the user does not approve, the tool MUST NOT execute. In non-interactive (batch/pipeline) mode, destructive tools MUST execute without prompting but log a warning to stdout.

#### Scenario: Destructive tool prompts for approval in TUI
- **WHEN** a destructive tool (e.g., file delete, shell command with side effects) is invoked in conversational mode
- **THEN** the TUI pauses and displays an approval prompt with the tool details

#### Scenario: User approves a destructive operation
- **WHEN** the user confirms the approval prompt
- **THEN** the tool executes with the requested arguments

#### Scenario: User denies a destructive operation
- **WHEN** the user declines the approval prompt
- **THEN** the tool aborts and returns `{ error: "operation-denied-by-user", tool: "<name>" }`

#### Scenario: Destructive tool executes without prompting in batch mode
- **WHEN** a destructive tool is invoked via the `--batch` CLI flag
- **THEN** the tool executes without user input and logs a warning: `"[WARNING] destructive tool executed in batch mode: <tool-name>"`

### Requirement: Tool Execution Logging
Every tool invocation SHALL produce a structured JSON log entry containing: timestamp, session ID, tool name, input (PII-redacted), output (PII-redacted), execution time in milliseconds, and the destructive flag. The system MUST strip PII from all log entries before writing. Tool execution time MUST be measured from the moment the tool begins execution to the moment it returns.

#### Scenario: Log entry contains execution metadata
- **WHEN** a tool completes execution
- **THEN** a JSON log line is written containing `session_id`, `tool`, `duration_ms`, `destructive`, and `status`

#### Scenario: Log contains redacted input and output
- **WHEN** a tool executes with arguments containing a password
- **THEN** the log entry shows the input as `{ ... "password": "[REDACTED]" }` rather than the actual value
