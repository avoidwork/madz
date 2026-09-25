# Feature Goals: Ellipsize Long Skill Descriptions in Skills View

## Goal
The skills view renders skill descriptions verbatim. Some skills have malformed or overly long descriptions (over 500 characters), which breaks the list layout. Apply an ellipsis when a description exceeds 500 characters.

## Scope
- **Included:** Truncate skill descriptions at render time in the skills panel when they exceed 500 characters, appending an ellipsis.
- **Excluded:** No changes to the skill schema validation. No changes to the underlying catalog/description data. No changes to other TUI panels.

## Key Requirements
1. Add a truncation helper that returns the description unchanged when `length <= 500`, otherwise returns `slice(0, 500) + "…"`.
2. Define the 500-character threshold as a named constant.
3. Apply the truncation at render time in `src/tui/skillsPanel.js` so the underlying `skill.description` is untouched.
4. Add unit tests covering: under 500 chars (unchanged), over 500 chars (truncated with ellipsis), and exactly 500 chars (not truncated).

## Acceptance Criteria
- A skill description longer than 500 characters renders truncated with an ellipsis in the skills view.
- A skill description of exactly 500 characters renders unchanged.
- A skill description under 500 characters renders unchanged.
- The underlying description data is not mutated.

## Dependencies
- `src/tui/skillsPanel.js` — the render point.
- `src/skills/types.js` — reference only (no change; the schema does not cap description).

## Risks / Edge Cases
- Descriptions exactly at the boundary (500 chars) must not be truncated.
- The ellipsis character `…` (U+2026) must be used, not three dots.
- The truncation must not mutate the original description object.
