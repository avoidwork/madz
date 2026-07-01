## Context

The madz project maintains two parallel memory loading pipelines:
- `loadContext` in `src/memory/context.js` — loads profile.md and recent context files, returns a plain string
- `loadMemories` in `src/memory/loadMemories.js` — loads all .md memory files, parses entry frontmatter, formats memories for prompts, returns structured entries

Both are called separately in `index.js` within `callProvider()`. This duplication creates maintenance overhead and confusion about responsibility boundaries.

## Goals / Non-Goals

**Goals:**
- Consolidate both pipelines into a single `loadContext` function
- Delete `src/memory/loadMemories.js`
- Preserve all existing functionality (structured entries, label mapping, prompt formatting)
- Maintain backward compatibility with existing call sites

**Non-Goals:**
- Changing the memory file format
- Modifying memory retention or garbage collection logic
- Adding new memory sources or loading mechanisms
- Changing the memory directory structure

## Decisions

1. **Keep structured return format:** The consolidated `loadContext` will return structured entries (array of `{key, metadata, memory}`) rather than a plain string. This preserves the existing behavior that `callProvider()` expects via `formatMemoriesForPrompt()`.

   *Rationale:* Minimizes changes to call sites in `index.js`. The string format was only used internally by `loadContext` for a different purpose.

2. **Move helpers into context.js:** `parseEntryFile()`, `formatMemoriesForPrompt()`, and `getMemoryContext()` will be moved into `context.js` as internal (non-exported) helpers.

   *Rationale:* These helpers are tightly coupled to memory loading logic and have no consumers outside the memory module.

3. **Preserve date sorting:** The existing logic that scans for `.md` files, sorts by date (newest first), and limits to recent entries will be preserved exactly.

   *Rationale:* This is a behavioral requirement that tests depend on.

4. **Merge, don't wrap:** Rather than having `loadContext` call `loadMemories` internally, the logic will be merged into a single function.

   *Rationale:* Eliminates the abstraction layer that creates confusion about responsibility.

## Risks / Trade-offs

- **Test migration effort:** `tests/unit/memories.test.js` has extensive tests for `loadMemories` that will need rewriting. → Mitigation: Tests map 1:1 to functionality, so migration is straightforward even if verbose.
- **Breaking internal API:** `src/memory/index.js` currently exports `loadMemories`, `formatMemoriesForPrompt`, and `parseEntryFile`. These exports will change. → Mitigation: These are internal module exports with no external consumers.
- **Function signature change:** `loadContext` currently takes no arguments and returns a string. The new version will accept a memory directory path and return structured entries. → Mitigation: This is a refactoring within the same module; all call sites are updated.

## Migration Plan

1. Add consolidated logic to `src/memory/context.js`
2. Update `src/memory/index.js` exports
3. Update `index.js` call sites
4. Delete `src/memory/loadMemories.js`
5. Migrate tests
6. Run full test suite and verify application starts

## Open Questions

None — all technical decisions have been resolved based on the audit findings in issue #494.