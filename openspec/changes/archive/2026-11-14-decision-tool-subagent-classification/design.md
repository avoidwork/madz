# Design

## Context

The `decision` tool is registered in `src/tools/index.js` via `buildToolConfig`, which builds a `runtimeOptions` object including `decisionConfig: config?.agent?.decision`. The `decision` case wraps `decisionImpl` in a closure that injects `decisionConfig` at registration (commit 946cfd0). Subagent tool routing is driven entirely by `TOOL_CLASSIFICATIONS` in `src/tools/index.js`: `createSubagentDefinitions` in `src/agent/deepAgents.js` calls `getToolsForAgentTypes([agentDef.name], TOOLS)` to build each subagent's `tools` array. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Extend the `decision` classification to the five judgment-heavy subagents.
- Preserve existing classifications and the config-gating behavior.

**Non-Goals:**
- No change to `decisionImpl`, the registration gate, or the config schema.
- No change to the `tool-classification` mechanism.

## Decisions

**Decision: Extend the `TOOL_CLASSIFICATIONS.decision` array.**

Add `"code-review"`, `"security-audit"`, `"debug"`, `"testing"`, and `"performance"` to the existing `decision: ["orchestrator", "coding", "research"]` array in `src/tools/index.js`.

**Alternatives considered:**
- *Add `decision` to all subagents* — Rejected. The synthesis/mechanical subagents (search, documentation, textEditor, seoAnalyst, translator) do not perform classification/scoring; adding the tool there would be noise.
- *Modify `getToolsForAgentTypes` or `deepAgents.js`* — Rejected. The classification map is the single source of truth; no routing code needs to change.

**Rationale:** The classification map is the sole routing mechanism. Extending it is minimal, localized, and preserves the existing config-gating and `decisionConfig` threading.

## Risks / Trade-offs

- [Tool appears in more subagents, increasing tool-surface noise] → Mitigation: Only the five judgment-heavy subagents are added; the five synthesis subagents are explicitly excluded.
- [Tests must account for config-gating] → Mitigation: Classification is static and independent of config; tests assert on `getToolsForAgentTypes` directly, not on registration.
