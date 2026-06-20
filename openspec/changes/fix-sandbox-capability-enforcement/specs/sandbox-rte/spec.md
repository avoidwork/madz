## MODIFIED Requirements

### Requirement: Capability Restriction via Permission Model
The sandbox SHALL enforce a capability model where each skill's granted permissions (`config.yaml` or skill metadata) determine what resources the child process can access. For Node.js scripts, enforcement is achieved by passing the `--permission` flag with the computed resource list to the spawned process. For non-Node.js interpreters (python, bash, ruby, etc.), the capability model is enforced at the application level via path resolution, URL filtering, and environment variable isolation.

#### Scenario: Skill with no permissions runs in minimal sandbox
- **WHEN** a skill declares zero permissions in its metadata
- **THEN** the child process receives read-only access to its own sandbox directory only

#### Scenario: Skill with network permission makes allowed request
- **WHEN** a skill declares `network:outbound` permission
- **THEN** the child process is allowed to make HTTP requests to allowlisted URLs

#### Scenario: Node.js script receives --permission flag
- **WHEN** a Node.js script (.js, .mjs, .ts) is executed with permissions like `["filesystem:read", "network:outbound"]`
- **THEN** the spawned process receives the `--permission filesystem:read,network:outbound` flag in its execArgv

#### Scenario: Non-Node.js script does not receive --permission flag
- **WHEN** a non-Node.js script (.py, .sh, .rb) is executed with permissions
- **THEN** the spawned process does not receive the `--permission` flag (capability enforcement is handled at the application level)