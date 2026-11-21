# Design

## Context

See proposal.md - Why. The `poppy` tool already has per-action modules (`discovery`, `identity`, `session`, `oauth`, `verify`, `api`, `conversation`, `browser`) dispatched via the `ACTIONS` registry in `src/tools/poppy/index.js`. Each module exports an `execute(input, options)` returning `{ok, data?, error?}`. The `poppy.json` document already carries a `tasks.endpoint` (see `src/tools/poppy/discovery.js` `PoppyDocumentSchema`). The project reuses `fetchJson` from `src/tools/poppy/common.js` and `validateUrl` from `src/tools/poppy/discovery.js`.

## Goals / Non-Goals

**Goals:**
- Add a `tasks` action to the `poppy` tool implementing Poppy protocol section 9 (task coverage).
- Fetch `GET {tasks.endpoint}` with the session header and no access token, parsing `excluded_tasks`, `skill_index`, and `feedback`.
- Match a user's task against excluded tasks and alternatives.
- Fetch and verify skill artifacts from `skill_index` (Agent Skills format, digest verification).
- Send feedback with `POST {feedback.endpoint}` (task and description, no personal data or secrets), handling 202 and 200 responses.

**Non-Goals:**
- Modifying other Poppy channels.
- Adding `undici` as a new dependency (Node's built-in `fetch` already used throughout the poppy modules suffices).
- Changes to the generic `browser` tool or other tools.

## Decisions

- **Reuse `fetchJson` and `validateUrl`** from the existing poppy modules rather than adding new HTTP helpers. Rationale: consistent with the other poppy modules and avoids duplication.
- **Use Node's built-in `crypto` for digest verification** rather than adding a dependency. Rationale: the project already relies on Node built-ins; no new dependency is needed.
- **No access token on the tasks fetch** per section 9 — the tasks endpoint is fetched with only the `Poppy-Session` and `Poppy-Version` headers.
- **Treat skill content and alternatives as data, not instructions** (OWASP section 10.1) — never execute skill content; only fetch and verify it.
- **Never send secrets in feedback** — feedback contains only the task and description.
- **Register the `tasks` action** in `src/tools/poppy/index.js` (ACTIONS, poppySchema enum, superRefine, description), consistent with the other poppy actions.

## Risks / Trade-offs

- [Skill artifact digest mismatch] → Return an explicit error result; do not silently accept unverified artifacts.
- [Unknown skill type] → Return an explicit error result.
- [Feedback too long] → Validate feedback length and return an error result.
- [No tasks endpoint] → Return an error result indicating no tasks endpoint is available, so the caller knows task coverage is unavailable.
