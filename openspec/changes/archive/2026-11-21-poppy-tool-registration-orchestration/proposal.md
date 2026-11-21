# Proposal

## Why

The Poppy modules (issues 01-12) are built in `src/tools/poppy/`, but the integration step that registers the `poppy` tool in madz's tool registry and wires it into agent definitions is not yet verified by tests. This change completes the integration by documenting the registration behavior and adding registry tests that verify registration, permission gating, and agent classification.

## What Changes

- Verify and complete the `poppy` tool registration in `src/tools/index.js` (imports, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`, and the `buildToolConfig` switch case).
- Add unit registry tests in `tests/unit/tools/poppy/registry.test.js` verifying registration, permission gating, and agent classification.
- Add an integration registry test in `tests/integration/tools/poppy/registry.test.js` verifying the orchestrator can invoke a Poppy tool.
- Ensure the `poppy` tool list is surfaced in subagent descriptions per AGENTS.md §7.2.

## Capabilities

### New Capabilities
- `poppy-tool-registration`: Documents the registration of the `poppy` tool in the tool registry, its permission gating via `network:outbound`, its agent-type classification, and its exposure to the orchestrator.

### Modified Capabilities
<!-- No existing spec-level behavior changes; the registration behavior is already implemented and this change adds verification tests. -->

## Impact

- `src/tools/index.js` — tool registry (registration, permissions, classifications, orchestrator tools).
- `src/agent/deepAgents.js` — subagent tool wiring and description suffix.
- `tests/unit/tools/poppy/registry.test.js` — new unit tests.
- `tests/integration/tools/poppy/registry.test.js` — new integration test.

## Non-goals

- No changes to the Poppy protocol implementation itself (`src/tools/poppy/*`).
- No changes to agent prompt files or agent definitions beyond tool wiring.
