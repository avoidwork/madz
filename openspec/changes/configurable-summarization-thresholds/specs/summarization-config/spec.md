## ADDED Requirements

### Requirement: SummarizationSchema defines the summarization config section
The system SHALL define a `SummarizationSchema` in `src/config/schemas/summarization.js`
that validates the `summarization` config section. The schema SHALL expose an
`enabled` boolean defaulting to `false`, a `trigger` object, a `keep` object, and a
`truncateArgs` object. The schema SHALL be re-exported from
`src/config/schemas/index.js` and composed into `ConfigSchema` in
`src/config/config.js` as `summarization: SummarizationSchema.default({})`.

#### Scenario: Section absent resolves to documented defaults
- **WHEN** `config.yaml` contains no `summarization` key
- **THEN** validation succeeds and `config.summarization.enabled` is `false`

#### Scenario: Schema is re-exported from the barrel
- **WHEN** `src/config/schemas/index.js` is imported
- **THEN** `SummarizationSchema` is available as a named export

#### Scenario: Malformed trigger is rejected with a clear error
- **WHEN** `config.yaml` sets `summarization.trigger.value` to `"lots"`
- **THEN** validation fails and the error identifies the `summarization.trigger.value` path

### Requirement: Trigger and keep accept only tokens and messages types
The `trigger` and `keep` values SHALL each be an object with a `type` restricted to
the enum `tokens` or `messages` and a positive integer `value`. The `fraction`
trigger type SHALL NOT be accepted, because madz never sets a model `profile`, so
`fraction` thresholds can never be resolved and would be dead configuration.

#### Scenario: tokens trigger is accepted
- **WHEN** a config sets `summarization.trigger` to `{ type: "tokens", value: 28000 }`
- **THEN** validation succeeds and the value round-trips unchanged

#### Scenario: messages trigger is accepted
- **WHEN** a config sets `summarization.trigger` to `{ type: "messages", value: 30 }`
- **THEN** validation succeeds and the value round-trips unchanged

#### Scenario: fraction type is rejected
- **WHEN** a config sets `summarization.trigger.type` to `"fraction"`
- **THEN** validation fails with a validation error naming the `type` field

#### Scenario: unknown trigger type is rejected
- **WHEN** a config sets `summarization.trigger.type` to `"characters"`
- **THEN** validation fails with a validation error

### Requirement: Threshold values are validated and never clamped
The schema SHALL reject `trigger.value` and `keep.value` that are zero, negative,
non-integer, or non-numeric, and SHALL reject a `truncateArgs.maxLength` that is not
a positive integer. The system SHALL reject invalid values rather than silently
clamping them to a safe range.

#### Scenario: Zero value is rejected
- **WHEN** a config sets `summarization.trigger.value` to `0`
- **THEN** validation fails with a validation error

#### Scenario: Negative value is rejected
- **WHEN** a config sets `summarization.keep.value` to `-1`
- **THEN** validation fails with a validation error

#### Scenario: Non-integer value is rejected
- **WHEN** a config sets `summarization.trigger.value` to `1000.5`
- **THEN** validation fails with a validation error

#### Scenario: Absurdly large value is rejected at a documented bound
- **WHEN** a config sets `summarization.trigger.value` to `10000001`
- **THEN** validation fails with a validation error rather than being clamped

#### Scenario: Trigger lower bound guards against cost amplification
- **WHEN** a config sets `summarization.trigger.value` to `1`
- **THEN** validation fails, because a trigger that fires on every call causes
  repeated summarization round-trips and extra LLM cost

#### Scenario: Values at the documented bounds are accepted
- **WHEN** a config sets `summarization.trigger.value` to `2` and
  `summarization.keep.value` to `1`
- **THEN** validation succeeds

#### Scenario: Large but plausible context window is accepted
- **WHEN** a config sets `summarization.trigger.value` to `1000000`
- **THEN** validation succeeds, so 1M-context models are not blocked by the bound

### Requirement: Unknown keys follow the existing config convention
The `summarization` section SHALL follow the repository's existing convention for
unknown keys: no `.strict()` modifier is applied to any config section schema, so
unrecognized keys SHALL be stripped during validation rather than causing a
rejection. Malformed values for recognized keys SHALL still be rejected.

#### Scenario: Unknown key is stripped without failing validation
- **WHEN** a config sets `summarization.bogusKey` to `"x"`
- **THEN** validation succeeds and `config.summarization` contains no `bogusKey`

#### Scenario: Stripping unknown keys does not mask invalid known keys
- **WHEN** a config sets both `summarization.bogusKey` and an invalid
  `summarization.trigger.value`
- **THEN** validation fails because of the invalid known key

### Requirement: Summarization thresholds support environment variable overrides
Adding the `summarization` section to `ConfigSchema` SHALL make `SUMMARIZATION_*`
environment variables materialize into the section automatically, with no change to
`src/config/loader.js`, because `KNOWN_SECTIONS` and `syncEnv()` derive from
`ConfigSchema`. The section name SHALL NOT collide with any entry in `DROPPED_KEYS`.
The schema shape SHALL keep every leaf at a primitive type so `buildReverseMap()`
registers them without special-casing. The generated names are `SUMMARIZATION_ENABLED`,
`SUMMARIZATION_TRIGGER_TYPE`, `SUMMARIZATION_TRIGGER_VALUE`, `SUMMARIZATION_KEEP_TYPE`,
`SUMMARIZATION_KEEP_VALUE`, `SUMMARIZATION_TRUNCATE_ARGS_TRIGGER_TYPE`,
`SUMMARIZATION_TRUNCATE_ARGS_TRIGGER_VALUE`, `SUMMARIZATION_TRUNCATE_ARGS_KEEP_TYPE`,
`SUMMARIZATION_TRUNCATE_ARGS_KEEP_VALUE`, and `SUMMARIZATION_TRUNCATE_ARGS_MAX_LENGTH`.

#### Scenario: Env var materializes a token trigger
- **WHEN** `SUMMARIZATION_ENABLED=true`, `SUMMARIZATION_TRIGGER_TYPE=tokens`, and
  `SUMMARIZATION_TRIGGER_VALUE=28000` are set in the environment
- **THEN** the resolved config has `summarization.enabled` true and a
  `trigger` of `{ type: "tokens", value: 28000 }`

#### Scenario: Env var materializes nested truncation settings
- **WHEN** `SUMMARIZATION_TRUNCATE_ARGS_MAX_LENGTH=500` is set in the environment
- **THEN** the resolved config has `summarization.truncateArgs.maxLength` of `500`

#### Scenario: Section name is a known section
- **WHEN** `KNOWN_SECTIONS` is derived from `ConfigSchema`
- **THEN** it includes `summarization`

#### Scenario: No collision with dropped env keys
- **WHEN** the env-var reverse map is built for the full `ConfigSchema`
- **THEN** no `SUMMARIZATION_*` name collides with an existing entry and none is
  dropped by `DROPPED_KEYS`

### Requirement: Summarization section is documented in config.yaml
The repository `config.yaml` SHALL include an active `summarization` block that
disables the feature (`enabled: false`), matching how `maxTokensMinute: 0` was
documented when it was introduced, plus commented example values showing `trigger`,
`keep`, and `truncateArgs`. The block SHALL state the cost implication of an
over-aggressive trigger. It SHALL NOT contain any internal hostname or vendor-internal
model identifier, because the repository is public.

#### Scenario: Active block parses to the disabled default
- **WHEN** `config.yaml` is loaded
- **THEN** `config.summarization.enabled` is `false` and the orchestrator is unchanged

#### Scenario: Documented example values are valid
- **WHEN** the commented example values for `trigger`, `keep`, and `truncateArgs` are
  applied to `SummarizationSchema`
- **THEN** they validate successfully

#### Scenario: No internal identifiers are documented
- **WHEN** `config.yaml` and the new source files are inspected
- **THEN** they contain no internal hostname or vendor-internal model identifier

### Requirement: Summarization section carries no credentials and logs no secrets
The `summarization` section SHALL hold thresholds only. It SHALL NOT accept credential
or endpoint fields — the provider base URL and API key remain in the existing provider
config and `process.env`. Any logging of the effective summarization settings SHALL use
structured fields from `src/shared/logger.js` and SHALL NOT include an API key, a base
URL, or conversation message content.

#### Scenario: Credential-shaped keys are not part of the section
- **WHEN** a config places an `apiKey` or `base_url` key under `summarization`
- **THEN** it is stripped as an unknown key and never reaches the middleware factory

#### Scenario: Startup logging excludes secrets and message content
- **WHEN** summarization is enabled and the orchestrator logs its effective settings
- **THEN** the log record contains the trigger and keep values and no API key, base
  URL, or message content

### Requirement: Unset summarization config preserves current behavior
When the `summarization` section is unset or `enabled` is `false`, the system SHALL
behave exactly as it does today: no madz-side summarization middleware is added to
the orchestrator stack, and the deepagents library default remains in force with a
170,000-token trigger, keep of 6 messages, and tool-argument truncation enabled.

#### Scenario: Disabled section adds no middleware
- **WHEN** `summarization.enabled` is `false`
- **THEN** no custom summarization entry is spread into the `middleware` array passed
  to `createDeepAgent()`

#### Scenario: Documented fallback values are recorded
- **WHEN** the effective summarization thresholds are needed with the section unset
- **THEN** the documented values are a 170,000-token trigger and a keep of 6 messages
