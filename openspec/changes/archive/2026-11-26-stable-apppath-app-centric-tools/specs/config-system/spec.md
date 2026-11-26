# Spec Delta

## ADDED Requirements

### Requirement: Immutable application root field
The config SHALL include a top-level `appPath` field (string, default `""`) representing the stable application root. The field SHALL be pinned once at bootstrap to the bootstrap-time working directory, normalized to an absolute, existing directory, and SHALL NOT be mutated afterward. It is distinct from `cwd`, which continues to track the live process working directory.

#### Scenario: appPath is populated at bootstrap
- **WHEN** the harness completes bootstrap
- **THEN** `config.appPath` is the absolute, existing application root captured before any project switch
- **AND** `config.cwd` continues to reflect the live process working directory

#### Scenario: appPath is never mutated after bootstrap
- **WHEN** the user switches projects after bootstrap
- **THEN** `config.appPath` retains its bootstrap-time value
- **AND** only `config.cwd` changes to reflect the selected project
