## ADDED Requirements

### Requirement: QuickJS VM wrapper
The system SHALL provide a QuickJS VM wrapper that executes JavaScript code in a sandboxed environment.

#### Scenario: VM initializes successfully
- **WHEN** the VM wrapper is instantiated with valid configuration
- **THEN** the QuickJS WASM module loads and a VM context is created

#### Scenario: VM executes code and returns result
- **WHEN** the `evaluate(code)` method is called with valid JavaScript code
- **THEN** the system returns the execution result as a string

#### Scenario: VM handles syntax errors
- **WHEN** the `evaluate(code)` method is called with invalid JavaScript syntax
- **THEN** the system returns an error string describing the syntax error

### Requirement: Snapshot serialization
The system SHALL serialize the VM state to a snapshot that can be restored later.

#### Scenario: Snapshot is created
- **WHEN** the snapshot method is called on a VM with state
- **THEN** the system returns a snapshot string containing the serialized state

#### Scenario: Snapshot is restored
- **WHEN** a snapshot string is passed to the restore method
- **THEN** the VM state is restored to the point captured by the snapshot

### Requirement: HMAC signature verification
The system SHALL sign snapshots with HMAC-SHA256 and verify integrity on restore.

#### Scenario: Valid signature passes verification
- **WHEN** a snapshot with a valid HMAC signature is restored
- **THEN** the system accepts the snapshot and restores the state

#### Scenario: Tampered signature is rejected
- **WHEN** a snapshot with a modified HMAC signature is restored
- **THEN** the system rejects the snapshot with an integrity error

### Requirement: Sandbox configuration
The system SHALL accept and apply sandbox configuration including memory limits, timeouts, and URL filtering.

#### Scenario: Memory limit is applied
- **WHEN** the VM is configured with a `memoryLimit` value
- **THEN** the VM enforces the limit during execution

#### Scenario: Timeout is applied
- **WHEN** the VM is configured with a `timeoutMs` value
- **THEN** the VM terminates execution after the timeout period

#### Scenario: URL filter is applied
- **WHEN** the VM is configured with URL filtering enabled
- **THEN** fetch calls to blocked URLs are rejected within the VM
