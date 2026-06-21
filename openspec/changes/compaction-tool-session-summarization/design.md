## Context

The existing `compactContext` tool is a mechanical context-window reducer (drop oldest, summarize middle, keep recent). It's designed for token-budget management, not for semantic distillation. When delegating to sub-agents, the parent needs a curated summary of conversation history — core decisions, key design points, open questions, and next steps — not a token-optimized compression.

Currently, there's no tool that produces this kind of semantic summarization. The parent agent would need to manually construct summaries, which is inconsistent and error-prone.

## Goals / Non-Goals

**Goals:**
- Add a `compaction` tool that produces semantic summarization of conversation sessions
- Tool spawns a node process to read session files and produce structured summaries
- Output uses `# Compaction` marker to separate thinking/reasoning from the final summary
- Tool integrates with existing tool registry

**Non-Goals:**
- Modifying existing `compactContext` tool behavior
- Changing session file format or storage
- Implementing summarization logic directly in the tool (delegated to spawned process)
- Real-time summarization (batch operation on session files)

## Decisions

### Decision 1: Spawn a node process for summarization logic
**Choice**: The tool spawns a node process to handle file I/O and summarization. The tool itself only handles execution and output parsing.
**Rationale**: Separation of concerns. The tool doesn't need to understand summarization logic — it just runs the script, splits on the marker, and returns what's after it. This keeps the tool simple and agnostic to the summarization method.
**Alternatives considered**:
- Implement summarization directly in the tool: Rejected — adds complexity, ties tool to specific summarization method
- Use existing `compactContext`: Rejected — it's a mechanical reducer, not a semantic summarizer

### Decision 2: Use `# Compaction` marker as output delimiter
**Choice**: The spawned process wraps the final summary with `# Compaction` marker. The tool splits on this marker and returns only content after it.
**Rationale**: Clean separation between thinking/reasoning (discarded) and final summary (returned). Simple contract that doesn't require the tool to understand the summarization method.
**Alternatives considered**:
- JSON wrapper: Rejected — adds parsing complexity, requires process to output valid JSON
- Fixed format without marker: Rejected — no way to distinguish thinking from output

### Decision 3: Empty permissions array
**Choice**: The compaction tool requires no special permissions (`TOOL_PERMISSIONS: []`).
**Rationale**: The spawned node process handles file I/O directly. The tool itself doesn't perform any filesystem operations — it just spawns a process and captures output.
**Alternatives considered**:
- Add `filesystem:read` permission: Rejected — the tool doesn't read files directly, the spawned process does

## Risks / Trade-offs

**Risk**: Node process spawn failures (timeout, permission errors)
**Mitigation**: 60-second timeout, error handling for spawn failures, stderr captured and included in error messages

**Risk**: Session file not found or malformed
**Mitigation**: The spawned process handles file reading; tool returns error if marker not found in output

**Risk**: Marker appears multiple times in output
**Mitigation**: Tool takes only the first split after marker (index[1]), discarding everything before it

**Risk**: Marker appears but no content follows it
**Mitigation**: Tool checks for empty content after marker and returns error