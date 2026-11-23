# Proposal

## Why

The `code-review` subagent is missing the `process` tool, which the shell-driven `review-code` skill requires to execute shell commands. Without it, the `code-review` agent cannot run the shell commands its review workflow depends on.

## What Changes

- Add `"code-review"` to the `process` classification in `src/tools/index.js` so the `code-review` agent resolves the `process` tool.
- Confirm `git` already includes `"code-review"` (no change needed).
- Update the `code-review-agent` spec to list `process` and `git` in the tool-access requirement and add a scenario asserting the agent can execute shell commands.
- Update `docs/FEATURES.md` to include `process` (and confirm `git`) in the `code-review` tool-access row.
- Add a regression test asserting `getToolsForAgentTypes(["code-review"], TOOLS)` includes `process` and `git`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-review-agent`: The "Code Review Agent Tool Access" requirement is updated to grant `process` and `git` to the `code-review` agent, with a new scenario asserting shell command execution.

## Impact

- `src/tools/index.js` — `TOOL_CLASSIFICATIONS.process` gains `"code-review"`.
- `src/agent/deepAgents.js` — auto-derives the `Tools:` description suffix from the updated classification (no manual edit).
- `openspec/specs/code-review-agent/spec.md` — tool-access requirement updated.
- `docs/FEATURES.md` — `code-review` tool-access row updated.
- `tests/unit/tool_index.test.js` — regression test added.

## Non-goals

- No change to other agents' tool sets.
- No change to the `git` classification (already includes `code-review`).
- No change to per-agent tool declarations in `agentDefinitions.js` (tool sets are derived from `TOOL_CLASSIFICATIONS`).
