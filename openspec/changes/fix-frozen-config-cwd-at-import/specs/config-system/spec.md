# Spec Delta

## ADDED Requirements

### Requirement: Explicit working directory injection
The system SHALL provide a `setConfig()` entry point that accepts an explicit working directory and SHALL normalize it to an absolute, real, existing path before storing it as the effective `config.cwd`. The normalization SHALL reject a value that does not exist, is not a directory, or resolves outside the allowed working-directory root, so the supplied path cannot escape the intended root.

#### Scenario: Valid cwd is normalized and pinned
- **WHEN** `setConfig()` is called with an absolute path to an existing directory
- **THEN** the effective `config.cwd` equals the normalized (resolved, absolute) path and subsequent `loadConfig()` calls return that same value

#### Scenario: Relative cwd is resolved to absolute
- **WHEN** `setConfig()` is called with a relative path
- **THEN** the value is resolved against the process working directory into an absolute path before being stored

#### Scenario: Non-existent cwd is rejected
- **WHEN** `setConfig()` is called with a path that does not exist
- **THEN** the call throws a validation error and the effective `config.cwd` is left unchanged

#### Scenario: Path outside the allowed root is rejected
- **WHEN** `setConfig()` is called with a path that resolves outside the intended working-directory root
- **THEN** the call throws a validation error and the effective `config.cwd` is left unchanged

### Requirement: loadConfig honors an explicitly-set cwd
When a working directory has been explicitly set via `setConfig()`, the config loader SHALL preserve that value across cached calls instead of overwriting it with a `process.cwd()` snapshot. The explicitly-set cwd SHALL take precedence over the lazily-captured process directory.

#### Scenario: Explicit cwd survives cached loadConfig calls
- **WHEN** `setConfig()` pins a cwd and `loadConfig()` is subsequently called (returning the cached config)
- **THEN** `loadConfig().cwd` still equals the explicitly-set value rather than the current `process.cwd()`

#### Scenario: Default cwd falls back to process directory
- **WHEN** no cwd has been explicitly set and `loadConfig()` is called for the first time
- **THEN** `config.cwd` defaults to the process working directory captured at that load

### Requirement: Modules derive cwd from live resolved config
Modules that consume the working directory SHALL derive `config.cwd` from the live resolved config at the time of use rather than freezing a snapshot at module-import time. A module's effective working directory SHALL reflect the explicitly-set cwd even after the process working directory changes.

#### Scenario: Caching module tracks the init-provided cwd after chdir
- **WHEN** a working directory is pinned during init, a module that consumes the cwd is imported, and the process working directory is then changed
- **THEN** the module's effective working directory still resolves to the init-provided cwd and not the changed process directory

#### Scenario: Frozen import-time snapshot is not used
- **WHEN** a consumer module is imported after the process working directory has already been switched
- **THEN** its path resolution uses the explicitly-set cwd rather than the directory active at import time
