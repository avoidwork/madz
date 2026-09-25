CHANGE_NAME: ellipsize-long-skill-descriptions

# Ellipsize Long Skill Descriptions in Skills View

## Summary
The skills view (`src/tui/skillsPanel.js`) renders each skill's `description` verbatim. Some skills at work have malformed or overly long descriptions exceeding 500 characters, which breaks the list layout. Apply an ellipsis when a description exceeds 500 characters.

## Technical Approach
In `src/tui/skillsPanel.js`, add a small truncation helper (e.g., `truncateDescription(desc, max = 500)`) that returns the description unchanged when `desc.length <= 500`, otherwise returns `desc.slice(0, 500) + "…"`. Define the 500-character threshold as a named constant (e.g., `DESCRIPTION_MAX_LENGTH = 500`). Apply the truncation at render time so the underlying `skill.description` is untouched.

The description originates from each skill's `SKILL.md` frontmatter and is surfaced via `registry.getCatalog()` as `{ name, description }`. The truncation belongs in the render layer so the catalog data is not mutated.

## Trade-offs
- Truncating at render time keeps the underlying data intact and is the least invasive change.
- The schema in `src/skills/types.js` does not cap `description` (only `compatibility` is capped at 500), so overlong descriptions are valid at the schema level. This change addresses the symptom in the view without changing validation behavior.

## Testing
Add unit tests covering: description under 500 chars renders unchanged, description over 500 chars is truncated with an ellipsis, and the boundary case (exactly 500 chars) is not truncated.
