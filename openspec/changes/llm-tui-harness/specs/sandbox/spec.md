## ADDED Requirements

### Requirement: Docker Container Orchestration
The system SHALL manage a Docker container lifecycle (create, start, stop, restart, health-check) for LLM inference and tool execution. The container SHALL be created with strict isolation: read-only root filesystem, dropped Linux capabilities (`--cap-drop=ALL`), no new privileges (`--security-opt=no-new-privileges`), and a volume mount restricted to the configured memory and settings directories. The system MUST verify container health before each tool or inference call.

#### Scenario: System creates a sandboxed container
- **WHEN** the application starts for the first time
- **THEN** the system creates and starts a Docker container with read-only filesystem, dropped capabilities, and volume mounts for memory and settings directories

#### Scenario: System verifies container health before use
- **WHEN** the system attempts to execute a tool or inference call
- **THEN** the system checks the container health status and proceeds only if healthy; if not, it attempts a restart and retries

#### Scenario: System stops container on exit
- **WHEN** the application process receives a termination signal (SIGTERM, SIGINT)
- **THEN** the system gracefully stops the Docker container and exits

### Requirement: Filesystem Isolation
All tool file operations SHALL be confined to the Docker container's volume-mounted directories. The container MUST NOT have access to the host filesystem outside of explicitly mounted volumes. File operations (read, write, delete, list) must resolve to paths within the mounted directories. The system MUST enforce maximum read size limits (`settings.tools.maxReadSize`) to prevent memory exhaustion from large file reads.

#### Scenario: File read is confined to mounted volumes
- **WHEN** a tool reads a file
- **THEN** the read is performed inside the Docker container at the resolved volume path; paths outside mounted directories are rejected

#### Scenario: File read respects size limit
- **WHEN** a tool attempts to read a file exceeding `maxReadSize` bytes
- **THEN** the system rejects the operation and returns a structured error: `{ error: "file-too-large", maxReadSize, actualSize }`

#### Scenario: File write is confined to mounted volumes
- **WHEN** a tool writes a file
- **THEN** the write is performed inside the Docker container at the resolved volume path; attempts to write outside mounted directories are rejected

### Requirement: Network Restrictions
The Docker container MUST have network access restricted to allowlisted domains. The container shall be started with no default network access; outbound connections to domains on the allowlist are permitted. Requests to non-allowlisted domains must fail with a network error. The container MUST use DNS resolution restricted to the allowlisted domains.

#### Scenario: Outbound request to allowlisted domain succeeds
- **WHEN** a tool makes an HTTP/S request to a domain on the allowlist
- **THEN** the request completes successfully inside the Docker container

#### Scenario: Outbound request to non-allowlisted domain fails
- **WHEN** a tool makes an HTTP/S request to a domain not on the allowlist
- **THEN** the request fails inside the Docker container with a network error: `{ error: "network-restricted", domain: "<domain>" }`

### Requirement: Process Boundaries
Tools that execute shell commands MUST run inside the Docker container with a configurable timeout. Shell execution MUST be sandboxed using `--no-new-privileges` and MUST NOT grant access to the host's process namespace. The container MUST run as a non-root user. The system MUST enforce a maximum execution time per tool to prevent hangs.

#### Scenario: Shell command executes with timeout
- **WHEN** a tool executes a shell command inside the container
- **THEN** the command runs with a configurable timeout; if the timeout expires, the command is killed and a timeout error is returned

#### Scenario: Shell command runs as non-root
- **WHEN** a shell command executes inside the container
- **THEN** the process runs as a non-root user inside the container; attempts to escalate privileges inside the container are blocked by the `--no-new-privileges` flag

### Requirement: Leak Prevention
The system MUST prevent data leakage between sessions by ensuring the Docker container's writable filesystem is ephemeral. Any state written to the container's tmpfs MUST be discarded on container restart. Memory files SHALL only be persisted through volume-mounted paths; all other writes inside the container MUST use tmpfs with no persistence. The system MUST audit container filesystem changes after each session.

#### Scenario: Container tmpfs is ephemeral
- **WHEN** the container writes temporary files to its writable layer
- **THEN** those files are discarded when the container restarts; they do not persist across sessions

#### Scenario: Only volume-mounted paths persist data
- **WHEN** the system audits the container filesystem after a session
- **THEN** all persistent data is confirmed to reside only within the volume-mounted memory and settings directories

### Requirement: Sandbox Mode Flag
The application MUST support a `--no-sandbox` runtime flag that bypasses Docker container orchestration, executing tools directly in-process for development purposes. When running without a sandbox, the application MUST log a warning: `"SAFETY: Running in no-sandbox mode — all isolation features disabled."`

#### Scenario: Application warns when no-sandbox mode is active
- **WHEN** the user starts the application with `--no-sandbox`
- **THEN** the application logs a safety warning to stdout and skips Docker container creation

#### Scenario: Tools execute in-process in no-sandbox mode
- **WHEN** the application runs with `--no-sandbox` and a tool is invoked
- **THEN** the tool executes in the local process without Docker; file operations directly modify the host filesystem
