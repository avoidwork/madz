## ADDED Requirement: hooks.js has no redundant re-exports

The system SHALL remove the `nextPanel` and `prevPanel` functions from `src/tui/hooks.js` since they are pass-through re-exports from `panels.js` with no added logic.

### Requirement: Consumers import from panels.js

The system SHALL update all import paths that reference `nextPanel` or `prevPanel` from `hooks.js` to import from `panels.js` directly.

#### Scenario: No broken imports
- **WHEN** the application loads the TUI module
- **THEN** no import errors occur

#### Scenario: No remaining stale imports
- **WHEN** searching for imports of `nextPanel` or `prevPanel` from `hooks.js`
- **THEN** no such imports exist

### Requirement: components.js removed or merged

The system SHALL either remove `src/tui/components.js` (if unused) or merge its exports into `src/tui/index.js` (if used).

#### Scenario: components.js is removed
- **WHEN** `components.js` is not imported anywhere in the codebase
- **THEN** the file is deleted

#### Scenario: components.js is merged
- **WHEN** `components.js` is imported by other files
- **THEN** its exports are moved to `index.js` and `components.js` is deleted

#### Scenario: No broken imports after cleanup
- **WHEN** the application loads the TUI module
- **THEN** no import errors occur
