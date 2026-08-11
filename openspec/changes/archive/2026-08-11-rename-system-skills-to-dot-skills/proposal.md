## Why

The system skills directory was renamed from `system-skills/` to `.skills/` in the codebase to follow Unix dot-file conventions for internal/system directories. The existing `skills-registry` spec still references the old naming and the `.agents/skills/` path, which no longer reflects the actual implementation. The spec must be updated to match reality.

## What Changes

- Update the `skills-registry` spec to reflect `.skills/` as the system skills directory path
- Remove references to `.agents/skills/` from the cross-client directory scanning requirement
- Update scenarios to use `.skills/` instead of `system-skills/` or `.agents/skills/`
- Clarify precedence: `.skills/` (system) shadows `skills/` (user)

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skills-registry`: Update cross-client directory scanning requirement to reflect `.skills/` as the system skills directory, remove `.agents/skills/` references, and update all related scenarios.

## Impact

- `openspec/specs/skills-registry/spec.md` — delta spec required
- No code changes — implementation already done in PR #763
