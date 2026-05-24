## ADDED Requirements

### Requirement: Containerized skill execution
The system SHALL execute all registered skills within a Docker container based on a multi-language runtime environment (RTE) image supporting Node.js and Python.

#### Scenario: Skill executes in container
- **WHEN** a registered skill is invoked
- **THEN** the system creates a containerized environment and runs the skill script inside it

#### Scenario: Runtime detection
- **WHEN** a skill script is written in a supported language (Node.js or Python)
- **THEN** the system detects the language from the script's shebang line or extension and uses the appropriate runtime

#### Scenario: Container cleanup on completion
- **WHEN** a skill execution completes (success or failure)
- **THEN** the system removes the temporary container to free resources

### Requirement: Filesystem isolation
The system SHALL enforce strict filesystem boundaries within the sandbox container, allowing access only to mounted volumes.

#### Scenario: Host filesystem inaccessible
- **WHEN** a skill execution attempts to read paths outside mounted volumes
- **THEN** the filesystem bind-mount configuration prevents access and the operation fails

#### Scenario: Memory volume writable
- **WHEN** a skill writes to the mounted `memory/` volume
- **THEN** the file system is correctly mounted as read-write and the skill can persist output

#### Scenario: Config volume readable
- **WHEN** a skill reads `config.yaml` from the mounted configuration volume
- **THEN** the volume is mounted as read-only and the skill can access configuration

### Requirement: Network policy enforcement
The system SHALL enforce network policies per skill based on the skill's declared capability, restricting or allowing outbound connections.

#### Scenario: Network-restricted skill blocked
- **WHEN** a skill with `network: false` attempts an outbound connection
- **THEN** the Docker network policy blocks the connection and the skill receives a network error

#### Scenario: Network-permitted skill routed
- **WHEN** a skill with `network: true` attempts an outbound connection
- **THEN** the system allows the connection only if the target URL passes the allowlist validation (no `file://`, `gopher://`, `dict://` schemes)

### Requirement: Process boundaries and resource limits
The system SHALL enforce CPU, memory, and process limits within the sandbox container.

#### Scenario: CPU limit enforced
- **WHEN** a skill execution exceeds its allocated CPU share
- **THEN** the Docker CPU limit throttles the process rather than starving the host

#### Scenario: Memory limit enforced
- **WHEN** a skill's memory usage exceeds the configured limit
- **THEN** the Docker OOM killer terminates the process and the system logs the event

#### Scenario: Process count limited
- **WHEN** a skill attempts to spawn more processes than permitted
- **THEN** the system rejects the fork/exec call

### Requirement: RTE Docker image management
The system SHALL build, cache, and update the multi-language Docker image used as the sandbox runtime environment.

#### Scenario: RTE image built on first run
- **WHEN** no sandbox image exists locally
- **THEN** the system builds the RTE image on first invocation and caches it for subsequent runs

#### Scenario: RTE image updated
- **WHEN** the `RTE_VERSION` environment variable or a config change indicates an image update
- **THEN** the system rebuilds the image and updates the cache without interrupting existing skill executions
