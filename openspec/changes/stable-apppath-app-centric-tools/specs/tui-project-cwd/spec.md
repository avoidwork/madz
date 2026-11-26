# Spec Delta

## ADDED Requirements

### Requirement: App files do not follow the project working directory
Moving the process working directory into a selected project SHALL affect only TUI display and consumers that intentionally operate on the active project. App-file-writing tools (memory, todo, session, skills discovery, context, screenshots, and similar outputs) SHALL resolve their storage paths against the stable application root (`config.appPath`), not the selected project's working directory.

#### Scenario: App files land in the application root after a switch
- **WHEN** the user selects a project, moving the process working directory into it
- **THEN** app files continue to resolve under the application root
- **AND** they are not written into the selected project directory

#### Scenario: Project-scoped display behavior is preserved
- **WHEN** the TUI displays or moves the process working directory for the selected project
- **THEN** it continues to use `config.cwd` (the live process working directory)
- **AND** the application root used for app files is unaffected
