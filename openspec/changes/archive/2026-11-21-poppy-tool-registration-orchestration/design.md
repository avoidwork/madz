# Design

## Context

See proposal.md - Why. The `poppy` tool is already imported and registered in `src/tools/index.js` (imports, `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`, and a `buildToolConfig` switch case). The remaining work is to add registry tests that verify this registration behavior and confirm the tool list is surfaced in subagent descriptions.

## Goals / Non-Goals

**Goals:**
- Verify the `poppy` tool registration in the tool registry via unit and integration tests.
- Confirm permission gating via `network:outbound`.
- Confirm agent-type classification and orchestrator exposure.
- Confirm the tool list is surfaced in subagent descriptions per AGENTS.md §7.2.

**Non-Goals:**
- No changes to the Poppy protocol implementation (`src/tools/poppy/*`).
- No new Poppy actions or capabilities.

## Decisions

**Decision: Add registry tests rather than re-implementing registration.**
The registration code is already present in main. The deliverable is verification. Tests are added in `tests/unit/tools/poppy/registry.test.js` (unit) and `tests/integration/tools/poppy/registry.test.js` (integration), mirroring the existing test conventions (`node --test`, `assert/strict`).

**Decision: Test permission gating via `buildToolConfig()`.**
`buildToolConfig()` is the single entry point that decides whether a tool registers based on the enabled permission set. Tests invoke it with and without `network:outbound` to verify the `poppy` tool is registered only when the permission is enabled. This mirrors the existing `image` tool gating pattern.

**Decision: Verify classification and orchestrator exposure via the exported maps.**
`TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS` are exported from `src/tools/index.js`. Tests assert the `poppy` entry is present in each, and that `getToolsForAgentTypes()` returns it for the classified agent types.

## Risks / Trade-offs

- [Registration code drifts from tests] → Tests assert the exported maps and `buildToolConfig()` behavior directly, so any drift is caught.
- [Key directory exposure] → The key directory is injected server-side via `runtimeOptions.poppyKeyDir` and never exposed to the model; tests verify the tool is registered without asserting key material.
