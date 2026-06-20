## Why

The `writeMemoryFile` function in `src/memory/writer.js` writes YAML frontmatter with string values wrapped in double quotes, but does not escape special characters within those strings. This causes YAML parsing errors when titles or frontmatter values contain double quotes, backslashes, or newlines. This is a medium-severity bug that can corrupt memory files and prevent them from being read correctly.

## What Changes

- Add an `escapeYamlString()` helper function that properly escapes backslashes, double quotes, and newlines for YAML double-quoted strings
- Apply escaping to the `title` field in the frontmatter output
- Apply escaping to all string frontmatter values before writing
- Update the test helper `buildMemoryContent` in `tests/unit/memory.test.js` to mirror the escaping logic
- Add unit tests for strings containing quotes, backslashes, and newlines

## Capabilities

### New Capabilities
<!-- No new capabilities — this is a bug fix -->

### Modified Capabilities
- `memory`: The memory writer now properly escapes special characters in YAML frontmatter string values, ensuring valid YAML output for titles and frontmatter containing quotes, backslashes, or newlines.

## Impact

- Affected code: `src/memory/writer.js` (escape helper + application to title and string frontmatter values)
- Affected tests: `tests/unit/memory.test.js` (update test helper + add new escaping tests)
- No API or dependency changes
- No breaking changes — existing valid YAML output remains unchanged