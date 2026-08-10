## ADDED Requirement: Filename matches exported function name

The system SHALL rename `src/memory/expireEphemeral.js` to `src/memory/expireEphemeralMemories.js` so the filename matches the exported function name `expireEphemeralMemories`.

### Requirement: All imports updated

The system SHALL update all import paths referencing the old filename to use the new filename.

#### Scenario: context.js import updated
- **WHEN** `src/memory/context.js` imports from `./expireEphemeral.js`
- **THEN** the import is updated to `./expireEphemeralMemories.js`

#### Scenario: index.js export updated
- **WHEN** `src/memory/index.js` exports from `./expireEphemeral.js`
- **THEN** the export is updated to `./expireEphemeralMemories.js`

#### Scenario: No broken imports
- **WHEN** the application loads the memory module
- **THEN** no import errors occur

### Requirement: No remaining old references

The system SHALL have zero remaining references to `expireEphemeral.js` in the codebase.

#### Scenario: No stale imports
- **WHEN** searching for `expireEphemeral.js` in the codebase
- **THEN** no matches are found
