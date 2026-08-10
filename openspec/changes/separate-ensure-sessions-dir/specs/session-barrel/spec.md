## ADDED Requirement: Barrel file contains only re-exports

The system SHALL ensure `src/session/index.js` contains only re-exports from other modules, with no standalone functions defined in the file.

### Requirement: ensureSessionsDir moved to factory.js

The system SHALL move the `ensureSessionsDir` function from `src/session/index.js` to `src/session/factory.js`.

#### Scenario: Function exists in factory.js
- **WHEN** importing `ensureSessionsDir` from `src/session/factory.js`
- **THEN** the function is available and callable

#### Scenario: Function removed from index.js
- **WHEN** reading `src/session/index.js`
- **THEN** no function definition for `ensureSessionsDir` exists in the file

#### Scenario: No circular dependency
- **WHEN** the module graph is analyzed
- **THEN** no circular dependency is introduced between `factory.js` and `index.js`

### Requirement: All consumers updated

The system SHALL update all import paths that reference `ensureSessionsDir` from the session barrel to use the new location.

#### Scenario: No broken imports
- **WHEN** the application loads the session module
- **THEN** no import errors occur
