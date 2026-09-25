## Context

The skills view (`src/tui/skillsPanel.js`) renders each skill's `description` verbatim. Some skills at work have malformed or overly long descriptions exceeding 500 characters, which breaks the list layout. The description originates from each skill's `SKILL.md` frontmatter and is surfaced via `registry.getCatalog()` as `{ name, description }`.

The `skills-registry` spec validates descriptions as 1-1024 characters, so overlong descriptions are valid at the schema level and flow straight through to the view. This is a rendering-layer concern.

## Goals / Non-Goals

**Goals:**
- Truncate skill descriptions at render time when they exceed a fixed character threshold.
- Append an ellipsis (`…`) to truncated descriptions.
- Keep the underlying `skill.description` data untouched.
- Define the threshold as a named constant.

**Non-Goals:**
- Changing skill description validation or the `skills-registry` spec.
- Modifying the underlying catalog/description data.
- Altering other TUI panels.

## Decisions

### Decision: Truncate at render time, not at the data layer
The truncation belongs in the render layer (`skillsPanel.js`) so the catalog data is not mutated. The description is a read-only input to the view; truncating it for display keeps the source of truth intact and is the least invasive change.

### Decision: Named constant for the threshold
Define `DESCRIPTION_MAX_LENGTH = 500` as a module-level constant. This makes the threshold self-documenting and easy to change.

### Decision: Use the ellipsis character `…` (U+2026)
The user requested an ellipsis. Use the single Unicode ellipsis character rather than three ASCII dots, matching the request.

### Decision: Pure helper function
Add a small pure helper `truncateDescription(desc, max = DESCRIPTION_MAX_LENGTH)` that returns `desc` unchanged when `desc.length <= max`, otherwise returns `desc.slice(0, max) + "…"`. It is pure and testable in isolation.

## Risks / Trade-offs

- **Boundary behavior** → The helper must not truncate a description that is exactly 500 characters. The `<=` comparison handles this.
- **Unicode length** → `String.length` counts UTF-16 code units. For the ellipsis and typical ASCII descriptions this is fine; the threshold is a display heuristic, not a byte-exact contract.
- **No schema change** → Overlong descriptions remain valid at the schema level. This is intentional; the view handles the symptom. If schema-level enforcement is desired later, it is a separate change.
