## ADDED Requirements

### Requirement: Optimistic Garbage Collection Trigger
When enabled, the system SHALL periodically check heap usage and trigger V8 garbage collection via `global.gc()` when the heap usage ratio exceeds a configurable threshold and the TUI is idle.

#### Scenario: GC triggers when heap threshold is exceeded during idle
- **WHEN** the TUI is idle (no active streaming) for at least `memory.gc.idleTimeoutMs`
- **AND** `heapUsed / heapTotal >= memory.gc.heapThreshold`
- **THEN** the system calls `global.gc()` and logs the heap usage percentage

#### Scenario: GC does not trigger during active streaming
- **WHEN** the TUI is actively streaming a response
- **THEN** the system skips GC even if heap threshold is exceeded

#### Scenario: GC does not trigger when below threshold
- **WHEN** `heapUsed / heapTotal < memory.gc.heapThreshold`
- **THEN** the system skips GC regardless of idle state

### Requirement: GC Graceful Degradation
When `--expose-gc` is not available (i.e., `global.gc` is undefined), the system SHALL log a single warning message on first detection and skip all subsequent GC checks silently.

#### Scenario: GC warns when --expose-gc is not enabled
- **WHEN** the GC manager starts and `global.gc` is undefined
- **THEN** the system logs a warning: `[gc] V8 garbage collection not available (node --expose-gc required)`
- **AND** the system does not attempt further GC calls

### Requirement: GC Configuration
The system SHALL support configurable GC parameters via `config.yaml` under `memory.gc`.

#### Scenario: GC can be disabled via config
- **WHEN** `memory.gc.enabled` is set to `false` in config
- **THEN** the GC manager does not start and no GC checks are performed

#### Scenario: GC uses custom interval and thresholds
- **WHEN** `memory.gc.intervalMs`, `memory.gc.idleTimeoutMs`, and `memory.gc.heapThreshold` are configured
- **THEN** the GC manager uses these values instead of defaults (30000ms, 10000ms, 0.8)
