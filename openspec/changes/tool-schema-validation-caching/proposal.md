## Why

When tools are removed, renamed, or have their schemas changed between sessions, the orchestrator may attempt to call tools that no longer exist or have incompatible signatures. LangChain's runtime schema validation catches these at call time, but failures are silent or produce confusing errors. A pre-check directive in the system prompt would catch these issues early and ensure the orchestrator always works with a known-good tool list.

## What Changes

- Add a new section to `SYSTEM_PROMPT.md` with a tool schema validation and caching directive.
- The directive instructs the orchestrator to resolve tool schemas from the tool registry at session start, cache them in session state, validate before each tool call, and handle mismatches gracefully.

## Capabilities

### New Capabilities
- `tool-schema-validation`: Tool schema resolution, caching, pre-call validation, and graceful mismatch handling.

### Modified Capabilities
- `system-prompt`: Adds a new section to the system prompt structure (no behavioral change to existing context-appending requirement).

## Impact

- **Affected code:** `prompts/SYSTEM_PROMPT.md` — new directive section.
- **Affected systems:** Orchestrator behavior at session start and before each tool call.
- **No breaking changes.** This is purely a directive addition to the system prompt.

## Non-goals

- Changes to LangChain's runtime schema validation (this is additive, not a replacement).
- Mid-session tool schema changes — tools don't change mid-session, so caching is safe.
- Tool registry implementation — the registry already exists.
