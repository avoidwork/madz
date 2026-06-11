## ADDED Requirements

### Requirement: V8 Garbage Collection
The system SHALL expose a `gc()` function that triggers V8's garbage collector when running with the `--expose-gc` Node.js flag.

#### Scenario: System triggers GC when idle
- **WHEN** the system has been idle for the configured `memory.gc.idleTimeoutMs` duration
- **AND** `memory.gc.enabled` is `true`
- **AND** the process was started with `--expose-gc`
- **THEN** the system calls `global.gc()` to trigger V8 garbage collection

#### Scenario: System gracefully handles missing --expose-gc
- **WHEN** the system attempts to trigger GC
- **AND** the process was NOT started with `--expose-gc`
- **THEN** the system logs a one-time warning and continues normally without error

#### Scenario: User triggers manual GC via TUI
- **WHEN** the user types `:gc` in the TUI
- **THEN** the system immediately calls `global.gc()` (if available) and displays the result in the status bar

#### Scenario: GC is rate limited
- **WHEN** the system has triggered GC `memory.gc.maxGcPerHour` times within one hour
- **THEN** additional GC triggers are skipped until the rate limit window resets

### Requirement: GC Availability Detection
The system SHALL detect whether `--expose-gc` is available and report this status.

#### Scenario: System reports GC availability
- **WHEN** the user types `:gc status` in the TUI
- **THEN** the system reports whether GC is available and when it last ran
