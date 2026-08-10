## ADDED Requirements

### Requirement: Logger module resides in src/shared/
The logger module SHALL be located at `src/shared/logger.js` instead of `src/logger.js`.

#### Scenario: Logger file exists at new path
- **WHEN** the codebase is checked
- **THEN** `src/shared/logger.js` exists and contains the full logger implementation

#### Scenario: Old logger path is removed
- **WHEN** the codebase is checked
- **THEN** `src/logger.js` does not exist

### Requirement: All import paths are updated
All files that previously imported from `src/logger.js` SHALL import from `src/shared/logger.js` instead.

#### Scenario: Direct import updated
- **WHEN** a file imports the logger module
- **THEN** the import path references `src/shared/logger.js` (or equivalent relative path)

#### Scenario: No broken imports remain
- **WHEN** the application starts
- **THEN** no module resolution errors occur for the logger module

### Requirement: Logger API surface unchanged
The logger module's public API SHALL remain identical after the move.

#### Scenario: Logger exports are preserved
- **WHEN** the logger module is imported from its new location
- **THEN** all previously exported functions and constants are available

#### Scenario: Logger behavior is identical
- **WHEN** the logger is used in any module
- **THEN** its output format, log levels, and behavior are unchanged
