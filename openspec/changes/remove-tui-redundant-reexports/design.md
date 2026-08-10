## Context

The `src/tui` module has two redundancy issues:
1. `hooks.js` exports `nextPanel` and `prevPanel` which are just pass-through re-exports from `panels.js`
2. `components.js` re-exports 7 components that are also re-exported via `index.js`

## Goals / Non-Goals

**Goals:**
- Remove redundant re-exports from hooks.js
- Remove or merge components.js
- Update all consumer import paths

**Non-Goals:**
- Any other TUI restructuring
- Behavioral changes

## Decisions

1. **Remove from hooks.js:** Since `nextPanel` and `prevPanel` add no logic, consumers should import directly from `panels.js`.

2. **Audit components.js:** Before removing, grep the entire codebase for imports of `components.js`. If unused, delete it. If used, merge its exports into `index.js`.

3. **No new barrel file:** Don't create a new intermediate barrel — consumers should import from the source file directly.

## Risks / Trade-offs

- **Consumer breakage:** Any file importing from `hooks.js` or `components.js` needs to update its import path. Mitigation: grep the entire codebase before making changes.
- **components.js might be used externally:** If external packages import from `components.js`, removal would be a breaking change. Mitigation: grep the entire codebase including node_modules references.
