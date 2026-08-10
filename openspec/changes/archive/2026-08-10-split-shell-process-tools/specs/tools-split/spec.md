## ADDED Requirement: Shell execution code in dedicated file

The system SHALL keep shell execution code (`executeForeground`, `executeBackground`, `executeShellImpl`, `shell`) in `src/tools/shell.js` only, with no process management code present.

### Requirement: Process management code in dedicated file

The system SHALL move all process management code (`processTracker`, `trackProcess`, `manageProcessImpl`, `processTool`) to `src/tools/process.js`.

#### Scenario: process.js exists and exports all process functions
- **WHEN** importing from `src/tools/process.js`
- **THEN** `processTracker`, `trackProcess`, `manageProcessImpl`, and `processTool` are all available

#### Scenario: shell.js has no process management code
- **WHEN** reading `src/tools/shell.js`
- **THEN** no definitions for `processTracker`, `trackProcess`, `manageProcessImpl`, or `processTool` exist

#### Scenario: shell.js imports trackProcess from process.js
- **WHEN** `src/tools/shell.js` calls `trackProcess` in `executeBackground`
- **THEN** the import resolves correctly from `process.js`

### Requirement: All consumers updated

The system SHALL update all import paths that reference process management exports from `shell.js` to use `process.js`.

#### Scenario: No broken imports
- **WHEN** the application loads the tools module
- **THEN** no import errors occur

#### Scenario: No remaining stale imports
- **WHEN** searching for imports of `processTracker`, `trackProcess`, `manageProcessImpl`, or `processTool` from `shell.js`
- **THEN** no such imports exist
