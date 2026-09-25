## Why

The skills view (`src/tui/skillsPanel.js`) renders each skill's `description` verbatim. Some skills at work have malformed or overly long descriptions exceeding 500 characters, which breaks the list layout. Applying an ellipsis at a fixed threshold keeps the skills list clean and readable.

## What Changes

- Add a truncation helper that returns a description unchanged when it is at or under 500 characters, and otherwise returns the first 500 characters followed by an ellipsis (`…`).
- Define the 500-character threshold as a named constant.
- Apply the truncation at render time in `src/tui/skillsPanel.js`, leaving the underlying `skill.description` untouched.
- Add unit tests covering the under-threshold, over-threshold, and exact-boundary cases.

## Capabilities

### New Capabilities
- `skills-view-description-truncation`: The skills view renders skill descriptions truncated with an ellipsis when they exceed a fixed character threshold, without mutating the underlying description data.

### Modified Capabilities
<!-- None — this is a rendering-layer change only. The skills-registry description validation (1-1024 chars) is unchanged. -->

## Impact

- **Code**: `src/tui/skillsPanel.js` — render layer truncation.
- **Tests**: `tests/unit/tui/skillsPanel.test.js` (or the existing skills panel test file).
- **No schema change**: `src/skills/types.js` and the `skills-registry` spec are untouched; overlong descriptions remain valid at the schema level.

## Non-goals

- Changing skill description validation or the `skills-registry` spec.
- Modifying the underlying catalog/description data.
- Altering other TUI panels.
