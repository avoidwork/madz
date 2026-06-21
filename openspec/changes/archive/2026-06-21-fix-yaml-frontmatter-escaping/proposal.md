## Why

The `saveSession` function in `src/session/saver.js` writes YAML frontmatter with string values wrapped in double quotes, but does not escape special characters within those strings. This causes YAML parsing errors when values like threadId contain double quotes, backslashes, or newlines. This is a medium-severity bug that can corrupt session files and prevent them from being read correctly.

## What Changes

- Add an `escapeYamlString()` helper function that properly escapes backslashes, double quotes, and newlines for YAML double-quoted strings
- Apply escaping to all string frontmatter values in the metadata object
- Update the test helper in `tests/unit/saver.test.js` to mirror the escaping logic
- Add unit tests for strings containing quotes, backslashes, and newlines

## Capabilities

### New Capabilities
<!-- No new capabilities — this is a bug fix -->

### Modified Capabilities
- `session`: The session saver now properly escapes special characters in YAML frontmatter string values, ensuring valid YAML output for thread IDs and frontmatter containing quotes, backslashes, or newlines.

## Impact

- Affected code: `src/session/saver.js` (escape helper + application to string frontmatter values)
- Affected tests: `tests/unit/saver.test.js` (add new escaping tests)
- No API or dependency changes
- No breaking changes — existing valid YAML output remains unchanged