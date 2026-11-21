# Spec Delta

## Purpose

Lets madz fetch a company's excluded tasks, published agent skills, and feedback endpoint, match a user's task against exclusions and alternatives, verify skill artifacts, and report tasks it couldn't do.

## ADDED Requirements

### Requirement: Task coverage is fetched from the tasks endpoint
The system SHALL fetch a company's task coverage from `GET {tasks.endpoint}` using the Poppy-Session header and no access token, parsing `excluded_tasks`, `skill_index`, and `feedback`.

#### Scenario: Task coverage is fetched
- **WHEN** the `tasks` action is invoked with a valid `endpoint` and session header
- **THEN** the system fetches `GET {tasks.endpoint}` and returns the parsed excluded tasks, skill index, and feedback

#### Scenario: No tasks endpoint is declared
- **WHEN** the company's poppy.json declares no `tasks.endpoint`
- **THEN** the system returns an error result indicating no tasks endpoint is available

### Requirement: Task coverage response is validated
The system SHALL validate the tasks response against a Zod schema before returning it.

#### Scenario: Invalid tasks response is rejected
- **WHEN** the tasks response fails Zod validation
- **THEN** the system returns an error result

### Requirement: User task is matched against excluded tasks
The system SHALL match a user's task against the company's excluded tasks and alternatives.

#### Scenario: Task matches an excluded task
- **WHEN** a user's task matches an entry in `excluded_tasks`
- **THEN** the system reports the task as excluded and returns the matching alternative if one exists

#### Scenario: Task is not excluded
- **WHEN** a user's task does not match any entry in `excluded_tasks`
- **THEN** the system reports the task as allowed

#### Scenario: Empty excluded tasks
- **WHEN** the company's `excluded_tasks` list is empty
- **THEN** the system reports no exclusions and allows the task

### Requirement: Skill artifacts are fetched and verified
The system SHALL fetch skill artifacts from `skill_index` and verify their digests.

#### Scenario: Skill artifact is fetched and verified
- **WHEN** a skill artifact is referenced by `skill_index`
- **THEN** the system fetches the artifact and verifies its digest

#### Scenario: Digest mismatch is rejected
- **WHEN** a fetched skill artifact's digest does not match the expected digest
- **THEN** the system returns an error result

#### Scenario: Unknown skill type is rejected
- **WHEN** a skill artifact has an unknown skill type
- **THEN** the system returns an error result

### Requirement: Feedback is sent to the feedback endpoint
The system SHALL send feedback with `POST {feedback.endpoint}` containing the task and description, with no personal data or secrets.

#### Scenario: Feedback is accepted
- **WHEN** feedback is posted and the endpoint returns 202
- **THEN** the system reports the feedback as accepted

#### Scenario: Feedback returns an alternative
- **WHEN** feedback is posted and the endpoint returns 200 with an alternative
- **THEN** the system returns the alternative

#### Scenario: Feedback is too long
- **WHEN** the feedback exceeds the allowed length
- **THEN** the system returns an error result

### Requirement: Task coverage is dispatched via the poppy tool
The system SHALL support a `tasks` action on the `poppy` tool that dispatches to the task-coverage module.

#### Scenario: Tasks action is dispatched
- **WHEN** the `poppy` tool is invoked with `action: "tasks"`
- **THEN** the system dispatches to the task-coverage module and returns its result
