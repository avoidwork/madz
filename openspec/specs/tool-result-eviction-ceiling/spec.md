# tool-result-eviction-ceiling Specification

## Purpose
TBD - created by archiving change config-driven-eviction-ceiling. Update Purpose after archive.
## Requirements
### Requirement: Derive eviction ceiling from image.maxSize
The system SHALL derive deepagents' `toolTokenLimitBeforeEvict` from the `image.maxSize` config value measured in **base64 characters**, computed as `Math.ceil((maxSize + ENVELOPE_HEADROOM) / 4)` where `ENVELOPE_HEADROOM` is a fixed 128-character allowance for the JSON envelope wrapping the base64 payload. The derivation SHALL NOT apply the base64 expansion factor (`* 1.33`) to `maxSize`, because `image.maxSize` budgets the base64-encoded output rather than the raw bytes.

#### Scenario: Default image.maxSize yields the expected ceiling
- **WHEN** `image.maxSize` is at its default of `100000`
- **THEN** the derived `toolTokenLimitBeforeEvict` is `25032`, giving an eviction threshold of `100128` stringified characters

#### Scenario: Custom image.maxSize yields a proportional ceiling
- **WHEN** `image.maxSize` is configured as `200000`
- **THEN** the derived `toolTokenLimitBeforeEvict` is `Math.ceil((200000 + 128) / 4)` = `50032`

#### Scenario: Unset image.maxSize falls back to the default
- **WHEN** the `image` config section is absent or `image.maxSize` is unset, zero, or otherwise not a finite positive number
- **THEN** the derivation uses the `100000` default and yields `25032` rather than `0`, `NaN`, `Infinity`, or `undefined`

#### Scenario: Ceiling is never falsy
- **WHEN** the derivation is invoked with any value of `image.maxSize`, including `0`, a negative number, `NaN`, `Infinity`, a string, or `undefined`
- **THEN** the returned `toolTokenLimitBeforeEvict` is a finite positive integer within the configured clamp bounds, so eviction is never disabled

### Requirement: Replace the library FilesystemMiddleware by name
The system SHALL register its own filesystem middleware built via `createFilesystemMiddleware` with `name` exactly `"FilesystemMiddleware"`, so deepagents' `mergeMiddlewareStack` same-name Map merge **displaces** the library default instead of stacking a second copy alongside it.

#### Scenario: Replacement carries the library middleware name
- **WHEN** the replacement middleware is constructed
- **THEN** its `name` property is exactly `"FilesystemMiddleware"`

#### Scenario: Replacement contributes the full filesystem tool set
- **WHEN** the replacement middleware is constructed with no harness profile excluding tools
- **THEN** its `tools` are the eight filesystem tools `ls`, `read_file`, `write_file`, `edit_file`, `delete`, `glob`, `grep`, `execute`, matching what a library-built instance contributes

#### Scenario: Replacement passes the derived ceiling to the library factory
- **WHEN** the replacement middleware is constructed for a given `image.maxSize`
- **THEN** the options handed to `createFilesystemMiddleware` include the derived `toolTokenLimitBeforeEvict`, `permissions: []`, and the `backend` supplied by the caller

### Requirement: Mirror the library harness-profile tool derivation
The system SHALL pass the `tools` option to `createFilesystemMiddleware` using the same derivation the library applies (`computeProfileFilesystemTools`): `undefined` when the active harness profile excludes no filesystem tool, otherwise the filtered list with `read_file` unconditionally included. The system SHALL resolve the harness profile for the active model using the library's documented lookup order (exact `provider:model`, then `providerHint:identifierHint`, then a bare identifier containing a colon, then the bare provider, then the empty profile) because `resolveHarnessProfile` is not exported.

#### Scenario: Model with no profile excludes nothing
- **WHEN** the active model resolves to no registered harness profile
- **THEN** the `tools` option is `undefined`, so all eight filesystem tools are contributed

#### Scenario: Profile that excludes tools narrows the tool set
- **WHEN** the active model's harness profile excludes `execute`, `grep`, and `ls`
- **THEN** the `tools` option is the remaining filesystem tools with `read_file` guaranteed present, matching the library's derivation for the same profile

#### Scenario: Per-subagent model resolves its own profile
- **WHEN** a subagent runs on a model instance distinct from the orchestrator's
- **THEN** the `tools` option for that subagent's replacement is derived from that subagent model's profile

### Requirement: Subagents inherit the config-derived eviction ceiling
The system SHALL attach the eviction-aware filesystem middleware to every inline subagent definition, because deepagents merges parent custom middleware only into the auto-injected `general-purpose` subagent and leaves configured inline subagents on the library default ceiling.

#### Scenario: Every configured subagent carries the replacement
- **WHEN** subagent definitions are built for the 12 configured agents
- **THEN** each definition's `middleware` array contains an entry whose `name` is `"FilesystemMiddleware"`

#### Scenario: Subagent ceiling matches the orchestrator's
- **WHEN** subagent definitions are built with a given `image.maxSize`
- **THEN** each subagent's replacement middleware was constructed from the same derived `toolTokenLimitBeforeEvict` as the orchestrator's

#### Scenario: Subagent definitions remain otherwise unchanged
- **WHEN** the replacement middleware is attached to a subagent definition
- **THEN** the definition's `name`, `description`, `model`, `tools`, and optional `skills` fields are unchanged

### Requirement: Clamp image.maxSize so eviction cannot be disabled
The `image.maxSize` config schema SHALL clamp the value to a bounded positive integer range so a mistyped value cannot disable tool-result eviction or permit an unbounded inline tool payload.

#### Scenario: Default is preserved
- **WHEN** `image.maxSize` is absent
- **THEN** it defaults to `100000`

#### Scenario: Value below the minimum is rejected
- **WHEN** `image.maxSize` is configured below the schema minimum
- **THEN** config validation rejects the value rather than yielding a ceiling that disables eviction

#### Scenario: Value above the maximum is rejected
- **WHEN** `image.maxSize` is configured above the schema maximum
- **THEN** config validation rejects the value rather than permitting a context-window denial of service

#### Scenario: Non-integer is rejected
- **WHEN** `image.maxSize` is configured as a non-integer or non-positive number
- **THEN** config validation rejects the value

