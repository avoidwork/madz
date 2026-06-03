## Context

The project uses LangChain's `@langchain/core/tools` for all assistant tools. Tools are created via factory functions in `src/tools/`, registered in `src/tools/index.js` via `TOOL_PERMISSIONS`, `TOOL_FACTORIES`, and `buildToolConfig`. The `date` tool requires no permissions, no API keys, and no external dependencies.

## Goals / Non-Goals

**Goals:**
- Provide a `date` tool that always returns an ISO 8601 timestamp internally (parseable, unambiguous).
- Support an optional `format` option to switch between `iso` (default) and `human-readable` output.
- Provide a `timezone` option (default: system timezone) for timezone-aware formatting.
- Integrate into the existing tools registration system with zero permissions.
- Maintain consistency with existing tool patterns (impl function + factory).

**Non-Goals:**
- Full date arithmetic (e.g., "date + 7 days") — that is a future enhancement.
- NLP-based date parsing (e.g., "yesterday", "next Monday") — the tool only returns "now".
- Configurable locales or plural localization — the formatter uses basic English conventions.

## Decisions

1. **ISO 8601 as the internal/native format.** All date operations work with ISO 8601 strings (`new Date().toISOString()`). This is parseable by any standard library, machine-readable, and unambiguous about timezone.

2. **Simple ternary dispatch.** The tool uses a one-line ternary: `format === "human" ? new Date().toString() : new Date().toISOString()`. No separate formatter module needed — both formats are built-in to `Date`.

3. **Zero permissions** — Like `clarify` and `execute_code`, the date tool reads nothing sensitive and writes nothing. No sandbox boundaries needed.

4. **Separate file `date.js`** — Consistent with the existing pattern where each tool has its own file in `src/tools/`.

## Risks / Trade-offs

- [Risk: Human-readable format varies across OS/locale] → **Mitigation**: ISO 8601 is the default. Human-readable is opt-in and users are warned of variability.
- [Risk: Tool called frequently in loops] → **Mitigation**: None needed — the operation is a single in-process timestamp capture with no I/O cost.
