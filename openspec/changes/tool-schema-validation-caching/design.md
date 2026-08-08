## Design: Tool Schema Validation & Caching

### Overview

Add a directive to `SYSTEM_PROMPT.md` that instructs the orchestrator to resolve, validate, and cache tool schemas at session start, then verify tool existence and parameter compatibility before each tool call. This is a pre-check layer that sits alongside LangChain's existing runtime validation.

### Architecture

```
┌─────────────────────────────────────────────────┐
│              Session Start                       │
│                                                  │
│  1. Fetch tool list + schemas from registry      │
│  2. Cache in session state                       │
│  3. Log resolved tools                           │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│            Before Each Tool Call                 │
│                                                  │
│  1. Check tool exists in cached schema list      │
│  2. Validate parameters against schema           │
│  3. If mismatch → clarify with user              │
│  4. If valid → proceed to LangChain runtime      │
└─────────────────────────────────────────────────┘
```

### Directive Specification

The directive added to `SYSTEM_PROMPT.md` will contain the following sections:

1. **Tool Schema Resolution** — At session start, fetch the complete tool list with schemas from the tool registry. Store in session state.

2. **Tool Schema Caching** — The resolved tool list persists across turns within the same session. No re-fetching needed mid-session.

3. **Pre-Call Validation** — Before invoking any tool:
   - Verify the tool exists in the cached schema list
   - Verify provided parameters match the tool's schema (required fields present, correct types)
   - If validation fails, clarify with the user rather than failing silently

4. **Graceful Degradation** — If the tool registry is unavailable at session start, proceed with currently bound tools and log a warning.

### Implementation Details

- **Location:** New section in `prompts/SYSTEM_PROMPT.md`
- **Format:** Markdown directive block, consistent with existing system prompt structure
- **No code changes required** — this is purely a prompt directive. The orchestrator reads `SYSTEM_PROMPT.md` at session start and follows the instructions.

### Edge Cases

- **Registry unavailable at startup:** Log warning, proceed with existing tools.
- **Tool removed between sessions:** Caught by pre-call validation on next session start.
- **Tool renamed between sessions:** Caught by pre-call validation on next session start.
- **Schema changed between sessions:** Caught by pre-call validation on next session start.

### Non-goals

- Mid-session schema refresh (tools don't change mid-session).
- Changes to the tool registry itself.
- Changes to LangChain's runtime validation layer.
