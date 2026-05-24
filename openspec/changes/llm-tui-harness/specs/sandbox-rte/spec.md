## ADDED Requirements

### Requirement: Process Isolation
The system SHALL execute all skill scripts in a forked Node.js process with constrained memory and CPU limits, preventing the sandboxed process from affecting the host environment.

#### Scenario: Skill executes in a forked process
- **WHEN** the harness invokes a registered skill
- **THEN** a new Node.js process is forked with `--max-old-space-size` and CPU cgroups applied as configured

#### Scenario: Child process is terminated on timeout
- **WHEN** a skill execution exceeds the configured `sandbox.timeout.seconds`
- **THEN** the forked process receives a SIGTERM and is killed with SIGKILL after a secondary grace period

### Requirement: Filesystem Access Control
The sandbox SHALL restrict file access to explicitly permitted paths. Skill scripts SHALL NOT be able to read or write outside the sandbox path and the mapped memory directory.

#### Scenario: Skill reads a permitted file
- **WHEN** a skill performs a filesystem read via `fs.readFile`
- **THEN** the system resolves the path and succeeds only if the resolved path falls within the allowed scope

#### Scenario: Skill attempts to access an unauthorized path
- **WHEN** a skill attempts to read a file outside its sandbox
- **THEN** the system intercepts the call and throws an `AccessDeniedError`

### Requirement: Network Access Control
The sandbox SHALL allow outbound network access only to URLs that match the allowlist defined in `config.yaml`. Schemes `file://`, `gopher://`, and `dict://` are always blocked.

#### Scenario: Skill makes an allowed network request
- **WHEN** a skill performs an HTTP request to a URL in the allowlist
- **THEN** the system permits the request and returns the response to the skill

#### Scenario: Skill attempts a disallowed request
- **WHEN** a skill attempts to connect to a URL not on the allowlist or using a blocked scheme
- **THEN** the system aborts the request and logs a `NetworkViolation` event to telemetry

### Requirement: Environment Variable Isolation
The sandbox SHALL inject only explicitly listed environment variables into the child process. Sensitive variables (e.g., `AUTH_API_KEY`, `OPENAI_API_KEY`) SHALL be injected from the harness config and NOT inherited from the host.

#### Scenario: Skill receives allowed environment variables
- **WHEN** a child process starts
- **THEN** only variables listed in `sandbox.env.allowlist` in `config.yaml` are injected

#### Scenario: Child process attempts to read host env vars
- **WHEN** a skill tries to access `process.env.UNKNOWN_VAR`
- **THEN** the variable is undefined as it was not injected

### Requirement: Capability Restriction via Permission Model
The sandbox SHALL enforce a capability model where each skill's granted permissions (`config.yaml` or skill metadata) determine what resources the child process can access.

#### Scenario: Skill with no permissions runs in minimal sandbox
- **WHEN** a skill declares zero permissions in its metadata
- **THEN** the child process receives read-only access to its own sandbox directory only

#### Scenario: Skill with network permission makes allowed request
- **WHEN** a skill declares `network:outbound` permission
- **THEN** the child process is allowed to make HTTP requests to allowlisted URLs
