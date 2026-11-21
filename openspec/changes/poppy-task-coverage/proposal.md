# Proposal

## Why

Poppy lets a company list tasks it chose not to offer, publish agent context as skills, and collect feedback. Today madz has Poppy channels for discovery, identity, session, OAuth, verify, API, conversation, and browser, but no task-coverage channel. This change adds it so madz knows up front what a company doesn't offer and can report tasks it couldn't do, reducing wasted effort.

## What Changes

- Add a `tasks` action to the `poppy` tool that fetches `GET {tasks.endpoint}` with the session header and no access token, parsing `excluded_tasks`, `skill_index`, and `feedback`.
- Match a user's task against excluded tasks and alternatives.
- Fetch and verify skill artifacts from `skill_index` (Agent Skills format, digest verification).
- Send feedback with `POST {feedback.endpoint}` (task and description, no personal data or secrets), handling 202 (accepted) and 200 (with an alternative) responses per section 9.

## Capabilities

### New Capabilities
- `poppy-task-coverage`: Lets madz fetch a company's excluded tasks, published agent skills, and feedback endpoint, match a user's task against exclusions and alternatives, verify skill artifacts, and report tasks it couldn't do.

### Modified Capabilities
- (none)

## Impact

- `src/tools/poppy/tasks.js` (new): the `tasks` action module.
- `src/tools/poppy/index.js`: extend `ACTIONS`, `poppySchema`, `superRefine`, and the tool description with the `tasks` action.
- `tests/unit/tools/poppy/tasks.test.js` (new): unit tests for excluded-task matching, skill index parsing and digest verification, feedback construction, and edge cases (no tasks endpoint, empty excluded_tasks, unknown skill type, digest mismatch, feedback too long).
- `tests/integration/tools/poppy/tasks.test.js` (new): integration test running against a mock tasks endpoint.
- Reuses `fetchJson` from `src/tools/poppy/common.js` and `validateUrl` from `src/tools/poppy/discovery.js`. No new dependency (Node's built-in `fetch` and `crypto` suffice).
