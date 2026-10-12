# config-loader-cleanup Specification

## Purpose
TBD - created by archiving change dedupe-config-loader. Update Purpose after archive.
## Requirements
### Requirement: Shared config value parser
The system SHALL provide a single shared `parseValue` helper in `src/config/parse.js` that coerces a string into the correct JavaScript type (`true`/`false` booleans, numeric strings, or the original string). Both `src/config/loader.js` and `src/config/patch.js` SHALL import this shared helper rather than defining their own duplicate implementations.

#### Scenario: parseValue parses boolean true
- **WHEN** `parseValue("true")` is called
- **THEN** it returns the boolean `true`

#### Scenario: parseValue parses boolean false
- **WHEN** `parseValue("false")` is called
- **THEN** it returns the boolean `false`

#### Scenario: parseValue parses numeric strings
- **WHEN** `parseValue("42")` or `parseValue("3.14")` is called
- **THEN** it returns the number `42` or `3.14` respectively

#### Scenario: parseValue preserves non-numeric strings
- **WHEN** `parseValue("hello")` is called
- **THEN** it returns the string `"hello"`

#### Scenario: loader uses the shared parseValue
- **WHEN** `src/config/loader.js` resolves an environment variable value
- **THEN** it uses the shared `parseValue` helper from `src/config/parse.js`

#### Scenario: patch re-exports parseValue for backward compatibility
- **WHEN** a consumer imports `parseValue` from `src/config/patch.js`
- **THEN** it receives the same shared helper from `src/config/parse.js`

### Requirement: Config loader behavior preserved
The system SHALL preserve the existing config loading and env-var resolution behavior after the refactor. The `DROPPED_KEYS` casing and comparison semantics SHALL remain unchanged, so that `subAgentsTemperature` is correctly kept in the env var name and resolves to `SUB_AGENTS_TEMPERATURE_CODING`.

#### Scenario: SUB_AGENTS_TEMPERATURE_CODING resolves correctly
- **WHEN** `SUB_AGENTS_TEMPERATURE_CODING=0.3` is set and `_resolveEnvRecursively` walks the `subAgentsTemperature` config path
- **THEN** the value resolves to `0.3` on the `coding` key

#### Scenario: DROPPED_KEYS casing is unchanged
- **WHEN** the config loader filters dropped container keys from an env var path
- **THEN** the `subAgentsTemperature` key is NOT dropped (because neither `"subAgentstemperature"` nor `"subAgentsTemperature"` matches the lowercased `"subagentstemperature"`), preserving the `SUB_AGENTS_TEMPERATURE_CODING` mapping

