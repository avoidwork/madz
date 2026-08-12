## Context

The reflection skill (`skills/reflection/SKILL.md`) currently discovers session files using a shell pipeline:
```bash
find memory/sessions -type f -mtime -7 ! -exec grep -qE "Run the scan-issues skill|Run the reflection skill" {} \; -printf "%T@ %p\n"
```

This approach has several problems:
- Ignore patterns are hardcoded in a shell regex, not configurable
- Session parsing relies on `awk`/`jq` which is error-prone with YAML frontmatter
- The reflection skill mixes file I/O plumbing with narrative generation
- No way to unit test the filtering logic

Session files in `memory/sessions/` have a consistent structure: YAML frontmatter with `startedAt`/`endedAt`/`threadId`/`messageCount`, followed by a JSON array of `{role, content, timestamp}` objects.

## Goals / Non-Goals

**Goals:**
- Create a Node.js tool (`src/tools/reflection.js`) that reads, filters, and extracts data from session files
- Make ignore patterns configurable via tool input
- Register the tool in `src/tools/index.js` with appropriate permissions and classification
- Replace the reflection skill's shell-based session discovery with a tool call

**Non-Goals:**
- Modifying the reflection skill's narrative generation logic
- Changing the session file format
- Creating a general-purpose session reader module
- Making ignore patterns configurable via config.yaml

## Decisions

### Decision 1: Tool Input vs Config File for Ignore Patterns
**Choice:** Pass ignore patterns as tool input parameters.
**Rationale:** The reflection skill has two hardcoded patterns. Storing them in config.yaml is overkill. Tool input provides flexibility without adding config complexity. The skill can read patterns from its guardrails and pass them to the tool.

### Decision 2: Use js-yaml for YAML Parsing
**Choice:** Use `js-yaml` (already a dependency) for YAML frontmatter parsing.
**Rationale:** The codebase already uses `js-yaml` for config loading. The existing `src/tools/memory.js` has a `parseEntryContent()` function that demonstrates the YAML frontmatter + JSON body pattern. We can reuse or extract this pattern.

### Decision 3: Graceful Error Handling for Malformed Files
**Choice:** Skip malformed sessions with a console warning, do not throw.
**Rationale:** Session files may be partially written or corrupted. The tool should be resilient — skip bad files rather than crashing the reflection skill.

### Decision 4: Tool Classification as `orchestrator`
**Choice:** Classify the reflection tool as `orchestrator` agent type.
**Rationale:** The reflection skill has `metadata.agent: "orchestrator"` in its SKILL.md. The tool serves the reflection skill's needs and should match.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Malformed YAML in session files | Try/catch around YAML parsing; skip file on error |
| Malformed JSON body | Try/catch around JSON parsing; skip file on error |
| Empty sessions directory | Return empty array, not an error |
| Large sessions directory (performance) | Use `fs/promises` with `readdir` — sequential processing is fine for typical session counts |
| Date parsing edge cases | Use `new Date()` with validation; skip sessions with invalid dates |

## Migration Plan

1. Create `src/tools/reflection.js` with full implementation
2. Register in `src/tools/index.js` (import, TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS)
3. Update reflection skill to use the new tool
4. Write unit tests in `tests/unit/tools/reflection.test.js`
5. No rollback needed — the shell-based approach remains as fallback if the tool fails

## Open Questions

- Should the tool return session metadata (threadId, messageCount) alongside user messages? The issue spec says no — only sessionId, startedAt, and userMessages. This keeps the interface minimal.
- Should the tool support a `sessionId` filter to read a single session? Not required by the issue — the reflection skill needs all sessions within the window.
