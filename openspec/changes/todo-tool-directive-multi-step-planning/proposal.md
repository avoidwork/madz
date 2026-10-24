## Why

The agent currently has no systematic way to track multi-step work. When executing chained skills or multi-step tasks, it can lose track of the overall work state, repeat steps, or leave work incomplete. A directive to use the `todo` tool gives the agent a persistent, inspectable plan that survives across turns and sessions.

## What Changes

- Add a directive to `prompts/SYSTEM_PROMPT.md` instructing the agent to use the `todo` tool for planning multi-step work and chained skills execution.
- Specify the lifecycle semantics:
  - **Starting new work:** clear the todo list (`todo clear` with `confirm: true`) before creating new items.
  - **Chained work:** when continuing chained work, add new items without clearing, so the overall work state is maintained.
  - **Completion:** when all work is done, clear the todo list.
- Add a unit test in `tests/unit/prompts.test.js` asserting the directive is present in the loaded system prompt.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `system-prompt`: Add a requirement that `SYSTEM_PROMPT.md` includes a directive instructing the agent to use the `todo` tool for planning multi-step work and chained skills execution, with the specified lifecycle semantics.

## Impact

- **Code**: `prompts/SYSTEM_PROMPT.md` (add directive), `tests/unit/prompts.test.js` (add assertion).
- **No code change** to `src/memory/prompts.js` — the loader reads the prompt file as-is.
- **No code change** to `src/tools/todo/index.js` — the tool already supports the required actions.

## Non-goals

- Changing the `todo` tool's implementation, schema, or registration.
- Changing the prompt-loading logic in `src/memory/prompts.js`.
- Adding any new tool or capability.
