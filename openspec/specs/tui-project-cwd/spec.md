# tui-project-cwd Specification

## Purpose
Keeps the OS process working directory in lockstep with the TUI's active project, so
that consumers reading `process.cwd()` (e.g. cron command builders) operate in the
directory the user selected, and restore it to the configured root when the project is
cleared or a new session begins.

## Requirements

### Requirement: Process cwd moves into the selected project
The TUI SHALL move the OS process working directory into the selected project directory
when the user selects a project, in addition to updating the in-memory active-project
state.

#### Scenario: Selecting a valid project
- **WHEN** the user selects a project whose directory exists
- **THEN** the process working directory becomes that project directory
- **AND** the in-memory active-project state reflects the same directory

#### Scenario: Selecting an invalid project path
- **WHEN** the user selects a project whose directory does not exist or cannot be entered
- **THEN** the process working directory is left unchanged
- **AND** the failure is recorded through the structured logger
- **AND** no exception propagates to crash the TUI

### Requirement: Process cwd restores on project clear
The TUI SHALL restore the OS process working directory to the configured root
(`config.cwd`, falling back to the current process cwd) when the user clears the active
project.

#### Scenario: Clearing the active project
- **WHEN** the user clears the active project
- **THEN** the process working directory is restored to `config.cwd` when it is set
- **AND** the in-memory active-project state is cleared

#### Scenario: Clearing with no configured root
- **WHEN** the user clears the active project and `config.cwd` is unset
- **THEN** the process working directory is restored to the current process cwd

### Requirement: Process cwd restores on new session
The TUI SHALL restore the OS process working directory to the configured root when a new
session begins, consistent with clearing the active project.

#### Scenario: Starting a new session
- **WHEN** the user starts a new session
- **THEN** the process working directory is restored to `config.cwd` when it is set
- **AND** the in-memory active-project state is cleared

### Requirement: Chdir failures are guarded and logged
Every process-working-directory change SHALL be guarded so that a failure to change
directory is recorded through the structured logger and never crashes the TUI.

#### Scenario: Chdir throws on an invalid target
- **WHEN** a process-working-directory change fails
- **THEN** the error is recorded through the structured logger
- **AND** the TUI continues to run
