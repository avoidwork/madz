## ADDED Requirements

### Requirement: Tool Definition Contract
Every standalone tool definition MUST expose the following fields defined as an object with the following fields: `name` (string, unique tool identifier), `description` (string, human-readable description), `destructive` (boolean, whether the tool should trigger approval gates), `schema` (function returning a zod validation schema for input), and `execute` (async function accepting validated input and returning tool output). The tool registration system MUST enforce these fields at registration time and reject any tool missing one or more required fields.

#### Scenario: Tool definition with all required fields is accepted
- **WHEN** a tool definition including `name`, `description`, `destructive`, `schema`, and `execute` is registered
- **THEN** the registry stores the tool and makes it available for dispatch

#### Scenario: Tool definition with missing schema is rejected
- **WHEN** a tool definition lacks the `schema` function
- **THEN** the registry throws a validation error and does not store the tool

#### Scenario: Tool definition with non-async execute is rejected
- **WHEN** a tool definition's `execute` function is not async
- **THEN** the registry logs a warning and rejects the tool definition

### Requirement: Input Validation
Every tool invocation MUST validate its input arguments against the tool's zod schema before execution. Tools MUST reject inputs that fail schema validation with a structured error identifying the field name, expected type, and actual value. The system MUST NOT log PII in validation errors — fields matching patterns for passwords, tokens, API keys, or credit card numbers SHALL be redacted before error output.

#### Scenario: Valid input passes validation and tool executes
- **WHEN** a tool receives input conforming to its zod schema
- **THEN** the application proceeds to tool execution with validated input

#### Scenario: Invalid input is rejected with structured error
- **WHEN** a tool receives input missing a required field
- **THEN** the application returns `{ error: "validation-failed", field: "<field-name>", message: "<description>" }` without executing

#### Scenario: PII is redacted in validation errors
- **WHEN** a validation error concerns a field containing a password or API key
- **THEN** the error output redacts the field value and displays `[REDACTED]` instead of the actual value

### Requirement: URL Allowlisting
Tools that access external resources (HTTP/S requests, API calls, webhook sends) MUST validate the target URL against the allowlist defined in `settings.sandbox.toolkit.allowlist`. The system SHALL reject access to URLs matching `file://`, `gopher://`, or `dict://` schemes regardless of the allowlist. Requests to domains not on the allowlist SHALL fail with `{ error: "domain-not-allowed", domain: "<domain>" }`.

#### Scenario: Request to allowlisted domain succeeds
- **WHEN** a tool fetches from a URL whose domain is in the allowlist
- **THEN** the request proceeds normally

#### Scenario: Request to non-allowlisted domain is denied
- **WHEN** a tool fetches from a URL whose domain is not on the allowlist
- **THEN** the tool returns `{ error: "domain-not-allowed", domain: "<domain>" }`

#### Scenario: Request to blocklisted scheme is denied
- **WHEN** a tool attempts access via `file://` URL
- **THEN** the tool returns `{ error: "scheme-not-allowed", scheme: "file" }`

### Requirement: Approval Gates for Destructive Operations
Before executing a tool with `destructive: true`, the system MUST present the operation details to the user and await explicit approval. The approval prompt MUST display the tool name, target resource, and a summary of the intended action. If the user does not approve, the tool MUST NOT execute. In non-interactive (batch/pipeline) mode, destructive tools MUST execute without prompting but log a warning to stdout.

#### Scenario: Destructive tool prompts for approval in TUI
- **WHEN** a destructive tool (e.g., file delete, shell command) is invoked in conversational mode
- **THEN** the TUI pauses and displays an approval prompt with the tool details

#### Scenario: User approves a destructive operation
- **WHEN** the user confirms the approval prompt
- **THEN** the tool executes with the requested arguments

#### Scenario: User denies a destructive operation
- **WHEN** the user declines the approval prompt
- **THEN** the tool aborts and returns `{ error: "operation-denied-by-user", tool: "<name>" }`

#### Scenario: Destructive tool executes without prompting in batch mode
- **WHEN** a destructive tool is invoked via the `--batch` CLI flag
- **THEN** the tool executes without user input and logs `[WARNING] destructive tool executed in batch mode: <tool-name>

### Requirement: Tool Execution Logging
Every tool invocation MUST produce a structured JSON log entry containing: timestamp, session ID, tool name, input (PII-redacted), output (PII-redacted), execution time in milliseconds, and the destructive flag. The system MUST strip PII from all log entries before writing. Tool execution time MUST be measured from the moment the tool begins execution to the moment it returns.

#### Scenario: Log entry contains execution metadata
- **WHEN** a tool completes execution
- **THEN** a JSON log line is written containing `session_id`, `tool`, `duration_ms`, `destructive`, and `status`

#### Scenario: Log contains redacted input and output
- **WHEN** a tool executes with arguments containing a password
- **THEN** the log entry shows the input as `{ ... "password": "[REDACTED]" }` rather than the actual value
