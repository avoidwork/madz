# Tasks

## 1. Task Coverage Module

- [x] 1.1 Create `src/tools/poppy/tasks.js` with a `TasksInputSchema` (Zod) requiring `op` and `endpoint`, and an `execute(input, options)` dispatcher, and verify the module imports cleanly
- [x] 1.2 Implement `fetchTasks(input, options)` that performs `GET {tasks.endpoint}` with the session header and no access token, parsing `excluded_tasks`, `skill_index`, and `feedback`, validated against a Zod schema, and verify via unit tests
- [x] 1.3 Implement `matchTask(tasks, task)` that matches a user's task against excluded tasks and alternatives, and verify via unit tests
- [x] 1.4 Implement `fetchSkills(skillIndex, options)` that fetches and verifies skill artifacts from `skill_index` (Agent Skills format, digest verification), and verify via unit tests
- [x] 1.5 Implement `sendFeedback(input, options)` that posts feedback with `POST {feedback.endpoint}` (task and description, no personal data or secrets), handling 202 (accepted) and 200 (with an alternative) responses per section 9, and verify via unit tests

## 2. Tool Registry Integration

- [x] 2.1 Register the `tasks` action in `src/tools/poppy/index.js` (ACTIONS, poppySchema enum, superRefine, description), and verify the poppy tool schema validates a `tasks` action

## 3. Tests

- [x] 3.1 Add `tests/unit/tools/poppy/tasks.test.js` covering excluded-task matching, skill index parsing and digest verification, feedback construction, and edge cases (no tasks endpoint, empty excluded_tasks, unknown skill type, digest mismatch, feedback too long), and verify the unit tests pass
- [x] 3.2 Add `tests/integration/tools/poppy/tasks.test.js` running against a mock tasks endpoint, and verify the integration test passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
