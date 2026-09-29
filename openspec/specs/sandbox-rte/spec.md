## Purpose

The sandbox runtime environment (RTE) securely executes skill scripts in an isolated Node.js process, restricting filesystem access, outbound network access, environment variables, and capabilities to explicitly permitted resources.
## Requirements
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
The sandbox SHALL allow outbound network access only to URLs that match the allowlist defined in `config.yaml`. Schemes `file://`, `gopher://`, and `dict://` are always blocked. Hostnames that resolve to internal/private IP addresses SHALL be blocked, and allowlist matching SHALL compare the exact hostname (and port) rather than a URL prefix.

#### Scenario: Skill makes an allowed network request
- **WHEN** a skill performs an HTTP request to a URL in the allowlist
- **THEN** the system permits the request and returns the response to the skill

#### Scenario: Skill attempts a disallowed request
- **WHEN** a skill attempts to connect to a URL not on the allowlist or using a blocked scheme
- **THEN** the system aborts the request and logs a `NetworkViolation` event to telemetry

#### Scenario: Hostname resolving to a private IP is blocked
- **WHEN** a skill attempts to connect to a hostname that resolves to an internal/private IP address (e.g., a domain pointing at `169.254.169.254`)
- **THEN** the system blocks the request, even though the hostname is not a literal IP string

#### Scenario: Allowlist rejects prefix-match bypass
- **WHEN** a skill attempts to connect to `https://example.com.evil.com` while `https://example.com` is allowlisted
- **THEN** the system rejects the request because the hostname does not exactly match the allowlisted host

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

