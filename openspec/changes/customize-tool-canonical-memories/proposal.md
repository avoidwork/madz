## Why

The memory system supports user-provided context notes in `memory/context/`, but has no mechanism to bootstrap that directory with a structured user profile. Without canonical user context, the agent lacks foundational knowledge about the user — name, preferences, relationship status, pets, hobbies, and other attributes that would meaningfully inform responses. Currently the user must manually create these notes via `:context add <text>`, which is error-prone and incomplete.

## What Changes

- A new `customize` tool that checks whether `memory/context/` is empty on agent startup or when invoked manually
- If empty, the tool initiates an interactive Q&A session to gather canonical user profile attributes
- Gathers attributes: name, handle, date of birth, relationship status, location, pets, hobbies, communication preferences, dietary restrictions, and free-form insights
- Writes the structured data as canonical memory files in `memory/context/` (e.g., `memory/context/user-profile.md`, `memory/context/preferences.md`, `memory/context/personal.md`)
- Updates `memory/_index.md` with entries for each new file
- The tool is registered as a Tier 1 skill (no network:outbound permission required)

## Capabilities

### New Capabilities

- `customize-tool`: Interactive user profiling tool that bootstraps canonical memory context files when `memory/context/` is empty

### Modified Capabilities

- `memory-system`: Extends the User-Provided Context Storage requirement to cover auto-generated canonical profile files (same storage mechanism, different origin)

## Impact

- **New file**: `src/tools/customize.js` — the customize tool implementation
- **New file**: `tests/unit/tools/customize.test.js` — unit tests
- **Modified**: `openspec/specs/memory-system/spec.md` — delta spec for canonical profile files
- **Dependencies**: None new — uses existing memory write path and index management
