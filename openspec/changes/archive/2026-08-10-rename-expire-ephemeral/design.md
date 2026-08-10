## Context

`src/memory/expireEphemeral.js` exports `expireEphemeralMemories` but the filename doesn't match. Two files import from it: `context.js` and `index.js`.

## Goals / Non-Goals

**Goals:**
- Rename file to match exported function name
- Update all import/export paths

**Non-Goals:**
- Any other file renames
- Behavioral changes

## Decisions

1. **Use `git mv`:** Preserves git history for the file content.
2. **No spec changes needed:** This is a pure refactoring with zero behavioral impact.

## Risks / Trade-offs

- **Dynamic imports:** If any code uses string-based imports, they won't be caught by static analysis. Mitigation: grep the entire codebase for `expireEphemeral` references.
