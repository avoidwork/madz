## ADDED Requirements

### Requirement: SSRF Protection Utility

The system SHALL provide a centralized SSRF protection utility in `src/tools/common.js` that validates outbound fetch destinations against private/reserved IP ranges and controls redirect chains.

#### Scenario: Block private IPv4 addresses
- **WHEN** an outbound fetch targets an IP address in the 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, or 127.0.0.0/8 ranges
- **THEN** the fetch is blocked and an error is thrown

#### Scenario: Block private IPv6 addresses
- **WHEN** an outbound fetch targets an IPv6 private address (fc00::/7, fe80::/10, or ::1/128)
- **THEN** the fetch is blocked and an error is thrown

#### Scenario: Block reserved IP ranges
- **WHEN** an outbound fetch targets a reserved IP address (0.0.0.0/8, 100.64.0.0/10, 169.254.0.0/16, 224.0.0.0/4, 240.0.0.0/4)
- **THEN** the fetch is blocked and an error is thrown

#### Scenario: Block redirects to private IPs
- **WHEN** an HTTP response redirects (3xx status) to a private or reserved IP address
- **THEN** the redirect is blocked and an error is thrown

#### Scenario: Allow public IP addresses
- **WHEN** an outbound fetch targets a public IP address
- **THEN** the fetch proceeds normally

#### Scenario: Allow public hostnames that resolve to public IPs
- **WHEN** an outbound fetch targets a hostname that resolves to a public IP address
- **THEN** the fetch proceeds normally

#### Scenario: Development mode bypass
- **WHEN** the development mode environment variable is set and an outbound fetch targets a private IP
- **THEN** the fetch proceeds with a warning logged

### Requirement: Output Accumulation Utility

The system SHALL provide a centralized output accumulation utility in `src/tools/common.js` that uses chunk arrays instead of string concatenation to prevent O(n²) memory growth for large outputs.

#### Scenario: Accumulate output via chunk array
- **WHEN** a tool accumulates stdout or stderr output
- **THEN** the output is pushed to an array and joined at the end with `join('')`

#### Scenario: Handle empty output
- **WHEN** a command produces no output
- **THEN** the accumulated result is an empty string

#### Scenario: Handle large output without memory explosion
- **WHEN** a command produces output larger than 64KB
- **THEN** memory usage grows linearly, not quadratically

#### Scenario: Handle partial writes
- **WHEN** output is written in multiple chunks
- **THEN** all chunks are preserved in order in the final result

### Requirement: Input Sanitization Utility

The system SHALL provide centralized input sanitization utilities in `src/tools/common.js` that prevent path traversal and shell injection attacks.

#### Scenario: Block path traversal in file paths
- **WHEN** a file path contains `../` sequences
- **THEN** the path is rejected and an error is thrown

#### Scenario: Escape user input for shell commands
- **WHEN** user-provided input is passed to a shell command (grep, sed, etc.)
- **THEN** special shell characters are escaped to prevent injection

#### Scenario: Allow safe paths without traversal
- **WHEN** a file path does not contain `../` or absolute paths outside allowed directories
- **THEN** the path is accepted

#### Scenario: Allow safe input without special characters
- **WHEN** user input does not contain shell special characters
- **THEN** the input is passed through unchanged

### Requirement: Command Sandboxing

The system SHALL sandbox terminal commands by blocking dangerous shell operations through a denylist approach.

#### Scenario: Block rm -rf on root
- **WHEN** a terminal command includes `rm -rf /` or similar destructive operations
- **THEN** the command is blocked and an error is returned

#### Scenario: Block disk formatting commands
- **WHEN** a terminal command includes `format`, `mkfs`, `dd`, or similar disk operations
- **THEN** the command is blocked and an error is returned

#### Scenario: Block network scanning commands
- **WHEN** a terminal command includes `nmap`, `netcat` with connection flags, or similar network reconnaissance
- **THEN** the command is blocked and an error is returned

#### Scenario: Allow safe commands
- **WHEN** a terminal command does not match any denylist patterns
- **THEN** the command executes normally

#### Scenario: Block command chaining for escalation
- **WHEN** a terminal command uses `&&`, `||`, or `;` to chain dangerous operations
- **THEN** the command is blocked and an error is returned

#### Scenario: Block environment variable manipulation for privilege escalation
- **WHEN** a terminal command attempts to set `LD_PRELOAD`, `LD_LIBRARY_PATH`, or similar environment variables
- **THEN** the command is blocked and an error is returned

### Requirement: Metadata Key Correctness

The system SHALL write the correct plural `permissions` key (not singular `permission`) to skill metadata to comply with the Agent Skills spec.

#### Scenario: Write correct permissions key
- **WHEN** a new skill is created via the skills tool
- **THEN** the metadata contains `permissions` (plural) not `permission` (singular)

#### Scenario: Read both keys during migration
- **WHEN** an existing skill is loaded
- **THEN** the system checks for `permissions` first, falls back to `permission` if not found

#### Scenario: Log warning for legacy key
- **WHEN** a skill is loaded with only the legacy `permission` key
- **THEN** a warning is logged indicating the skill has malformed metadata

### Requirement: Async File System Operations

The system SHALL use async file system operations instead of synchronous blocking calls in async functions.

#### Scenario: Use fs.access instead of existsSync
- **WHEN** checking if a file exists in an async function
- **THEN** `fs.access()` is used instead of `fs.existsSync()`

#### Scenario: Handle access errors gracefully
- **WHEN** `fs.access()` returns an error (file not found, permission denied)
- **THEN** the error is handled appropriately without crashing

### Requirement: Base64 Encoding Without Stack Limit

The system SHALL use `Buffer.from().toString('base64')` for base64 encoding instead of `String.fromCharCode.apply()` to eliminate call stack limits for large inputs.

#### Scenario: Encode small images
- **WHEN** an image smaller than 64KB is encoded to base64
- **THEN** the encoding completes successfully

#### Scenario: Encode large images
- **WHEN** an image larger than 64KB is encoded to base64
- **THEN** the encoding completes without stack overflow

#### Scenario: Produce identical output
- **WHEN** the same image is encoded with the old and new methods
- **THEN** the base64 output is identical

### Requirement: HTML Parsing Resilience

The system SHALL use a DOM parser (cheerio) instead of fragile HTML regex for parsing web search results.

#### Scenario: Parse standard DDG HTML
- **WHEN** DuckDuckGo returns standard HTML search results
- **THEN** the results are parsed correctly using the DOM parser

#### Scenario: Parse unexpected HTML structure
- **WHEN** DuckDuckGo changes its HTML structure
- **THEN** the parser handles the new structure gracefully without silent failures

#### Scenario: Handle missing elements
- **WHEN** expected HTML elements are missing from the response
- **THEN** the parser returns empty results rather than throwing errors

### Requirement: Memory Growth Prevention

The system SHALL implement history rotation and chunked file reading to prevent unbounded memory growth in the clarify tool.

#### Scenario: Rotate history when limit exceeded
- **WHEN** the clarify history exceeds the configured maximum entries
- **THEN** the oldest entries are removed to maintain the limit

#### Scenario: Read large history files in chunks
- **WHEN** a history file is larger than the configured size limit
- **THEN** the file is read in chunks rather than all at once

#### Scenario: Maintain conversation continuity
- **WHEN** history is rotated
- **THEN** the most recent N entries are preserved for context

### Requirement: Error Propagation

The system SHALL propagate chain-level errors instead of silently swallowing them.

#### Scenario: Log swallowed errors
- **WHEN** a task-queue chain-level error occurs
- **THEN** the error is logged and propagated rather than silently caught

#### Scenario: Track accurate queue depth
- **WHEN** tasks are added to or removed from the queue
- **THEN** `_getQueueDepth` returns the accurate count of pending tasks

### Requirement: Python Sandbox Expansion

The system SHALL expand the Python import hook in code.js to block additional dangerous modules.

#### Scenario: Block ctypes import
- **WHEN** a Python script attempts to import `ctypes`
- **THEN** the import is blocked and an error is raised

#### Scenario: Block importlib import
- **WHEN** a Python script attempts to import `importlib`
- **THEN** the import is blocked and an error is raised

#### Scenario: Block pickle import
- **WHEN** a Python script attempts to import `pickle`
- **THEN** the import is blocked and an error is raised

#### Scenario: Block urllib import
- **WHEN** a Python script attempts to import `urllib`
- **THEN** the import is blocked and an error is raised

#### Scenario: Allow safe imports
- **WHEN** a Python script imports a module not in the denylist
- **THEN** the import proceeds normally

### Requirement: setrlimit Child Process Application

The system SHALL apply `setrlimit` to the child process environment rather than the parent process for Python memory sandboxing.

#### Scenario: Apply memory limit to child process
- **WHEN** a Python script is spawned with memory limits
- **THEN** the `setrlimit` call applies to the child process, not the parent

#### Scenario: Child process respects memory limit
- **WHEN** a Python script exceeds the configured memory limit
- **THEN** the child process is terminated by the OS

### Requirement: Token Estimation Accuracy

The system SHALL improve token estimation accuracy beyond the 1-token-per-4-chars heuristic for code and JSON content.

#### Scenario: Estimate tokens for natural language
- **WHEN** token estimation is performed on natural language text
- **THEN** the estimation is within 15% of actual token count

#### Scenario: Estimate tokens for code
- **WHEN** token estimation is performed on code content
- **THEN** the estimation uses a more accurate heuristic than 1-token-per-4-chars

#### Scenario: Estimate tokens for JSON
- **WHEN** token estimation is performed on JSON content
- **THEN** the estimation accounts for JSON-specific tokenization patterns

### Requirement: Ephemeral Memory Count Optimization

The system SHALL optimize ephemeral memory file counting by using directory listing instead of parsing every `.md` file.

#### Scenario: Count ephemeral entries quickly
- **WHEN** the count of non-expired ephemeral memory entries is requested
- **THEN** the count is computed using directory listing and metadata, not file-by-file parsing

#### Scenario: Accurate count
- **WHEN** ephemeral entries are created or expired
- **THEN** the count accurately reflects the current state

### Requirement: JSDoc Cleanup

The system SHALL maintain clean, standard-compliant JSDoc comments across all tool files.

#### Scenario: No garbled JSDoc
- **WHEN** JSDoc comments are parsed from tool files
- **THEN** no garbled text, tab characters, or control characters are present

#### Scenario: Standard JSDoc format
- **WHEN** JSDoc comments are validated
- **THEN** they follow standard JSDoc format conventions

### Requirement: Skill Execution Sandboxing

The system SHALL sandbox skill script execution (cron.js) with permission-based access control for filesystem, network, and resource limits.

#### Scenario: Block filesystem operations outside allowed directories
- **WHEN** a skill script attempts to read or write files outside its allowed directory
- **THEN** the operation is blocked and an error is returned

#### Scenario: Restrict network access by skill permissions
- **WHEN** a skill script makes a network request
- **THEN** the request is allowed only if the skill declares network permission

#### Scenario: Apply memory limits to skill scripts
- **WHEN** a skill script exceeds its allocated memory limit
- **THEN** the script is terminated

#### Scenario: Apply CPU limits to skill scripts
- **WHEN** a skill script exceeds its allocated CPU time limit
- **THEN** the script is terminated

### Requirement: List Operation Optimization

The system SHALL optimize the memory list operation by batching file reads and adding a caching layer for frequently accessed entries.

#### Scenario: Batch file reads for list operation
- **WHEN** the memory list operation is invoked with 100+ entries
- **THEN** file reads are batched rather than performed sequentially

#### Scenario: Cache frequently accessed entries
- **WHEN** a memory entry is accessed multiple times
- **THEN** subsequent accesses are served from cache

#### Scenario: Invalidate cache on entry modification
- **WHEN** a memory entry is created, updated, or deleted
- **THEN** the cache is invalidated for that entry

### Requirement: Filesystem Output Accuracy

The system SHALL accurately report file operation metrics using byte counts (Buffer.byteLength) rather than character counts (string.length).

#### Scenario: Report bytes not characters in success message
- **WHEN** a file write operation reports its success message
- **THEN** the byte count (Buffer.byteLength) is reported, not character count (string.length)

#### Scenario: Bound nativeSearch file reads by size
- **WHEN** nativeSearch reads a file for searching
- **THEN** the file read is bounded by a configurable size limit

#### Scenario: Optimize fuzzyMatch intermediate strings
- **WHEN** fuzzyMatch processes a large file
- **THEN** intermediate string creation is minimized to avoid memory bloat

### Requirement: Model Configurability and Timeout Control

The system SHALL allow model selection and timeout configuration for MOA (Multi-Option Agreement) calls instead of using hardcoded values.

#### Scenario: Configure model for MOA calls
- **WHEN** a MOA call is initiated
- **THEN** the model can be configured via settings instead of using hardcoded `openai/gpt-4o`

#### Scenario: Configurable per-API timeout
- **WHEN** a MOA call makes parallel API requests
- **THEN** the per-API timeout is configurable and defaults to a reasonable value (not 60s)

#### Scenario: Parallel execution with timeout control
- **WHEN** multiple MOA options are evaluated in parallel
- **THEN** the total wall-clock time is bounded by the timeout configuration