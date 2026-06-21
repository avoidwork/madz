## Why

When delegating to a sub-agent, the parent needs a clean summary of what was discussed — not a full session dump, not a mechanical token-budget reducer, but a semantic distillation of the conversation's key points. This tool provides that capability, enabling sub-agents to receive curated context about prior work.

## What Changes

- Add a new `compaction` tool that produces semantic summarization of conversation sessions
- Tool spawns a node process to read session files and produce structured summaries
- Output uses `# Compaction` marker to separate thinking/reasoning from the final summary
- Tool integrates with existing tool registry in `src/tools/index.js`
- Add unit tests for parsing, spawning, and tool registration

## Capabilities

### New Capabilities
- `compaction`: Semantic session summarization tool that distills conversation history into core decisions, key design points, open questions, and next steps

### Modified Capabilities
<!-- None — this is a new tool, not a modification of existing requirements -->

## Impact

- **Affected code**: `src/tools/index.js` (registration), new `src/tools/compaction.js` (implementation)
- **Dependencies**: `@langchain/core/tools`, `zod` (already present)
- **Session files**: Reads from `memory/sessions/` directory
- **No breaking changes**: New tool, no modifications to existing tool contracts