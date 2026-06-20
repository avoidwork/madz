## Context

The `writeMemoryFile` function in `src/memory/writer.js` generates YAML frontmatter for memory files. String values (title and frontmatter fields) are wrapped in double quotes without escaping special characters. When a string contains double quotes, backslashes, or newlines, the resulting YAML is malformed and cannot be parsed correctly by the memory reader in `src/memory/index.js`.

## Goals / Non-Goals

**Goals:**
- Add a dedicated `escapeYamlString()` helper that properly escapes backslashes, double quotes, and newlines for YAML double-quoted strings
- Apply escaping to the title field and all string frontmatter values
- Update the test helper in `tests/unit/memory.test.js` to mirror the escaping logic
- Add unit tests covering special character edge cases

**Non-Goals:**
- Changes to the YAML parsing logic in `src/memory/index.js` (it already handles unescaping via quote stripping)
- Changes to memory file naming or directory structure
- Adding a YAML library dependency

## Decisions

1. **Use string replacement rather than a YAML library** — The escaping requirement is simple (backslashes, quotes, newlines). Importing a library would add unnecessary dependencies for a focused fix.

2. **Escape order: backslashes first, then quotes, then newlines** — Backslashes must be escaped first to avoid double-escaping. If we escaped quotes first, the backslashes added by quote escaping would themselves need escaping.

3. **Internal helper, not exported** — The `escapeYamlString()` function is only needed for frontmatter generation within writer.js. Exporting it would expose an implementation detail with no external consumers.

4. **Double-quoted YAML strings** — The existing code uses double quotes for all string values. We maintain this convention rather than switching to single quotes or block scalars, minimizing the scope of change.

## Risks / Trade-offs

- [Risk] Escape order could produce incorrect output if not implemented carefully → Mitigation: Unit tests verify all three escape types independently and in combination
- [Risk] Existing tests don't cover special characters → Mitigation: New tests added specifically for quotes, backslashes, and newlines
- [Trade-off] Simple string replacement may not handle all YAML edge cases (e.g., tab characters) → Acceptable: The most common problematic characters are covered; future enhancements can expand if needed