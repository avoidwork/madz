# context-priority Specification

## Purpose
TBD - created by archiving change prioritize-profile-ephemeral-context. Update Purpose after archive.
## Requirements
### Requirement: Profile loaded first in context
The `loadContext` function SHALL always load `profile.md` as the first file in the context output, regardless of file timestamps or directory ordering.

#### Scenario: Profile.md is loaded first
- **WHEN** `loadContext` is called and `profile.md` exists in the memory directory
- **THEN** the content of `profile.md` appears as the first section in the returned context string

#### Scenario: Profile.md missing is handled gracefully
- **WHEN** `loadContext` is called and `profile.md` does not exist in the memory directory
- **THEN** the function continues processing other files without error and profile content is omitted from the context

### Requirement: Ephemeral files filtered from main processing
The `loadContext` function SHALL skip any file whose name starts with `ephemeral` during the main file processing loop.

#### Scenario: Ephemeral files are excluded from main processing
- **WHEN** `loadContext` processes files in the memory directory
- **THEN** any file whose name starts with `ephemeral` is skipped and not included in the main context output

#### Scenario: Non-ephemeral files are processed normally
- **WHEN** `loadContext` processes files in the memory directory
- **THEN** files whose names do not start with `ephemeral` are processed according to the existing timestamp-based ordering logic

### Requirement: Ephemeral memories loaded last with limit
The `loadContext` function SHALL load a limited set of ephemeral memories after all persistent context has been processed, sorted by timestamp with newest first.

#### Scenario: Ephemeral memories loaded after persistent context
- **WHEN** `loadContext` completes processing all non-ephemeral files
- **THEN** the function reads the memory directory again, filters for files starting with `ephemeral`, and appends them to the context output

#### Scenario: Ephemeral memories sorted newest first
- **WHEN** `loadContext` loads ephemeral files
- **THEN** they are sorted by modification timestamp in descending order (newest first)

#### Scenario: Ephemeral limit is respected
- **WHEN** more ephemeral files exist than the configured `memory.ephemeralLimit`
- **THEN** only the most recent `memory.ephemeralLimit` ephemeral files are loaded

#### Scenario: Default ephemeral limit when not configured
- **WHEN** `memory.ephemeralLimit` is not set in `config.yaml`
- **THEN** the function defaults to loading the 5 most recent ephemeral files

#### Scenario: No ephemeral files handled gracefully
- **WHEN** no files starting with `ephemeral` exist in the memory directory
- **THEN** the function completes without error and no ephemeral content is added to the context

