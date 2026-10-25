## MODIFIED Requirements

### Requirement: Replace the library FilesystemMiddleware by name
The system SHALL register its own filesystem middleware built via `createFilesystemMiddleware` with `name` exactly `"FilesystemMiddleware"`, so deepagents' `mergeMiddlewareStack` same-name Map merge **displaces** the library default instead of stacking a second copy alongside it.

#### Scenario: Replacement carries the library middleware name
- **WHEN** the replacement middleware is constructed
- **THEN** its `name` property is exactly `"FilesystemMiddleware"`

#### Scenario: Replacement supplies madz's file tool instead of the library's eight
- **WHEN** the replacement middleware is constructed with no harness profile excluding tools
- **THEN** its `tools` are madz's own `file` tool (or no filesystem tools at all), not the library's eight `ls`, `read_file`, `write_file`, `edit_file`, `delete`, `glob`, `grep`, `execute`

#### Scenario: Replacement passes the derived ceiling to the library factory
- **WHEN** the replacement middleware is constructed for a given `image.maxSize`
- **THEN** the options handed to `createFilesystemMiddleware` include the derived `toolTokenLimitBeforeEvict`, `permissions: []`, and the `backend` supplied by the caller
