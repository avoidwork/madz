# app-root-path Specification

## Purpose

Defines the stable, immutable application root that all app-file-writing tools use to resolve their on-disk storage paths, independent of any change to the OS process working directory performed when the user switches projects.

## Requirements

### Requirement: Immutable application root captured at bootstrap
The system SHALL capture a stable application root once during bootstrap, before any process-working-directory change, and SHALL keep that value for the lifetime of the run. The application root SHALL be normalized to an absolute, existing directory and SHALL NOT be mutated after bootstrap.

#### Scenario: Root is captured before any project switch
- **WHEN** the harness boots with `process.cwd()` at the application root
- **THEN** the application root is set to that bootstrap-time directory
- **AND** the value is an absolute, existing directory

#### Scenario: Root is unchanged after a project switch
- **WHEN** the user selects a project, moving the process working directory into the project
- **THEN** the application root remains the bootstrap-time directory
- **AND** no subsequent operation changes the application root

### Requirement: App-file-writing tools resolve against the application root
Tools and modules that write app files (memory, todo, session, skills discovery, context, screenshots, and similar outputs) SHALL resolve their storage paths against the stable application root rather than the live process working directory.

#### Scenario: Memory entry written after a project switch
- **WHEN** a memory tool is generated after the user has switched into a project
- **THEN** the memory entry is written under the application root
- **AND** it is not written into the selected project directory

#### Scenario: Todo and session writes follow the application root
- **WHEN** a todo or session file is created after the user has switched into a project
- **THEN** the file is resolved under the application root
- **AND** it is not written into the selected project directory

### Requirement: Application root is validated to stay within the intended directory
The system SHALL validate and normalize the application root to an absolute, existing directory at bootstrap so it cannot be used to escape the intended working directory. No app-file-writing tool SHALL fall back to an unvalidated process-working-directory snapshot for app-path construction.

#### Scenario: Root resolves to an absolute existing directory
- **WHEN** the application root is established at bootstrap
- **THEN** it is normalized to an absolute path
- **AND** the directory is confirmed to exist before use

#### Scenario: No unvalidated cwd fallback for app paths
- **WHEN** an app-file-writing tool resolves its storage path
- **THEN** it uses the validated application root
- **AND** it does not fall back to a raw `process.cwd()` snapshot for app-file placement
