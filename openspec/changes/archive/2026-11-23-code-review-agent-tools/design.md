# Design

## Context

See proposal.md - Why. The `code-review` agent is missing the `process` tool, which the shell-driven `review-code` skill requires. Tool sets are derived from `TOOL_CLASSIFICATIONS` in `src/tools/index.js` via `getToolsForAgentTypes`, not declared per-agent.

## Goals / Non-Goals

**Goals:**
- Grant `process` to the `code-review` agent through the single integration point (`TOOL_CLASSIFICATIONS`).
- Keep the change minimal and confined to the classification map plus spec/docs/test updates.

**Non-Goals:**
- No change to other agents' tool sets.
- No change to the `git` classification (already includes `code-review`).
- No per-agent tool declarations in `agentDefinitions.js`.

## Decisions

- **Modify `TOOL_CLASSIFICATIONS.process` to include `"code-review"`.** This is the single integration point that `getToolsForAgentTypes` reads. Alternatives considered: declaring a per-agent tool list in `agentDefinitions.js` — rejected because the project derives tool sets from the classification map, and a per-agent list would diverge from that pattern.
- **No manual description edit.** `createSubagentDefinitions` in `src/agent/deepAgents.js` auto-derives the `Tools:` description suffix from `filteredToolNames`, so the description updates automatically once the classification changes (per AGENTS.md 7.2).
- **Update the spec and docs to match.** The `code-review-agent` spec's tool-access requirement and `docs/FEATURES.md` tool-access row are updated to reflect the new tool set.

## Risks / Trade-offs

- [Unintentionally altering another agent's tool set] → The change is a single array addition; verified by the regression test that `getToolsForAgentTypes(["code-review"], TOOLS)` includes `process` and `git`.
- [Spec/docs drift from actual tool set] → Spec and docs updated in the same change; the regression test guards the classification.
