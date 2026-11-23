# Spec Delta

## MODIFIED Requirements

### Requirement: Task coverage response is validated
The system SHALL validate the tasks response against a Zod schema before returning it. The `skill_index` SHALL be the spec `{ "$schema", "skills": [...] }` shape, and valid skill types SHALL be `skill-md` and `archive`.

#### Scenario: Invalid tasks response is rejected
- **WHEN** the tasks response fails Zod validation
- **THEN** the system returns an error result

#### Scenario: Skill index uses spec shape
- **WHEN** a tasks response is validated
- **THEN** the `skill_index` is validated against the spec `{ "$schema", "skills": [...] }` shape

#### Scenario: Valid skill types are accepted
- **WHEN** a tasks response lists skill types `skill-md` or `archive`
- **THEN** the system accepts the response

#### Scenario: Unknown skill type is rejected
- **WHEN** a tasks response lists a skill type other than `skill-md` or `archive`
- **THEN** the system returns an error result

### Requirement: User task is matched against excluded tasks
The system SHALL match a user's task against the company's excluded tasks and alternatives. Each excluded task SHALL have a required `task` field and an optional `alternative` object with `instructions`/`references`.

#### Scenario: Task matches an excluded task
- **WHEN** a user's task matches an entry in `excluded_tasks`
- **THEN** the system reports the task as excluded and returns the matching alternative if one exists

#### Scenario: Task is not excluded
- **WHEN** a user's task does not match any entry in `excluded_tasks`
- **THEN** the system reports the task as allowed

#### Scenario: Empty excluded tasks
- **WHEN** the company's `excluded_tasks` list is empty
- **THEN** the system reports no exclusions and allows the task

#### Scenario: Excluded task requires a task field
- **WHEN** an excluded task entry is missing the required `task` field
- **THEN** the system returns an error result

#### Scenario: Alternative is an object with instructions and references
- **WHEN** an excluded task has an `alternative`
- **THEN** the alternative is validated as an object with `instructions`/`references`

### Requirement: Skill artifacts are fetched and verified
The system SHALL fetch skill artifacts from `skill_index` and verify their digests. The digest SHALL be the SHA-256 of the raw bytes prefixed `sha256:`.

#### Scenario: Skill artifact is fetched and verified
- **WHEN** a skill artifact is referenced by `skill_index`
- **THEN** the system fetches the artifact and verifies its digest

#### Scenario: Digest mismatch is rejected
- **WHEN** a fetched skill artifact's digest does not match the expected digest
- **THEN** the system returns an error result

#### Scenario: Digest is SHA-256 of raw bytes prefixed sha256
- **WHEN** a skill artifact's digest is verified
- **THEN** the system computes the SHA-256 of the raw bytes and compares against the expected value prefixed `sha256:`

#### Scenario: Unknown skill type is rejected
- **WHEN** a skill artifact has an unknown skill type
- **THEN** the system returns an error result

### Requirement: Feedback is sent to the feedback endpoint
The system SHALL send feedback with `POST {feedback.endpoint}` containing the task and description, with no personal data or secrets. The `task` field SHALL be capped at 200 characters.

#### Scenario: Feedback is accepted
- **WHEN** feedback is posted and the endpoint returns 202
- **THEN** the system reports the feedback as accepted

#### Scenario: Feedback returns an alternative
- **WHEN** feedback is posted and the endpoint returns 200 with an alternative
- **THEN** the system returns the alternative

#### Scenario: Feedback is too long
- **WHEN** the feedback exceeds the allowed length
- **THEN** the system returns an error result

#### Scenario: Task field is capped at 200 characters
- **WHEN** a feedback `task` field exceeds 200 characters
- **THEN** the system returns an error result
