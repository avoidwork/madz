# Proposal

## Why

The `decision` tool provides fast, deterministic classification (routing, policy checks, rubric scoring, severity/priority ranking) via a local SystemOne model. It is currently available only to the orchestrator and the `coding` and `research` subagents. Several subagents perform judgment-heavy work — code review severity scoring, security risk ranking, debug hypothesis selection, test prioritization, and performance bottleneck classification — where a quick structured decision is more appropriate than a long reasoning chain. They cannot use the tool because it is not in their classification.

## What Changes

- Extend the `decision` tool's `TOOL_CLASSIFICATIONS` entry in `src/tools/index.js` to include `code-review`, `security-audit`, `debug`, `testing`, and `performance`.
- Preserve the existing classifications (`orchestrator`, `coding`, `research`).
- Update the `decision-tool` spec's "Permission model" requirement to reflect the expanded subagent availability.
- Add regression tests asserting the tool is routed to the five target subagents and excluded from the five non-target subagents.

## Capabilities

### New Capabilities

<!-- None — this extends an existing capability. -->

### Modified Capabilities

- `decision-tool`: The "Permission model" requirement changes so the `decision` tool is available to the orchestrator and the `coding`, `research`, `code-review`, `security-audit`, `debug`, `testing`, and `performance` subagents.

## Impact

- `src/tools/index.js` — `TOOL_CLASSIFICATIONS` map; the `decision` entry gains five agent types.
- `src/agent/deepAgents.js` — no change; `createSubagentDefinitions` already reads the classification map via `getToolsForAgentTypes`.
- `tests/unit/tool_index.test.js` — add regression tests for the new classifications.
- `openspec/specs/decision-tool/spec.md` — update the "Permission model" requirement.

## Non-goals

- No change to the `decision` tool implementation, registration gate, config schema, or `decisionImpl` logic.
- No change to the `tool-classification` capability's general classification mechanism.
- No addition of the tool to `search`, `documentation`, `textEditor`, `seoAnalyst`, or `translator` subagents.
