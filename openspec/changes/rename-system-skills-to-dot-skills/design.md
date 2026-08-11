## Context

The system skills directory was renamed from `system-skills/` to `.skills/` in PR #763. This was a straightforward rename across all source files, tests, config, and the Dockerfile. The implementation is complete and merged. This change is purely to update the OpenSpec spec to reflect the current state of the codebase — no code changes are needed.

## Goals / Non-Goals

**Goals:**
- Update the `skills-registry` spec to reflect `.skills/` as the system skills directory
- Remove stale `.agents/skills/` references from the cross-client scanning requirement
- Ensure the spec accurately describes the current implementation

**Non-Goals:**
- No code changes — implementation already done
- No new features or behaviors
- No migration required (already shipped)

## Decisions

**Decision: Delta spec only, no full rewrite.**
The existing `skills-registry` spec has many requirements that are unchanged. We only modify the `Cross-Client Directory Scanning` requirement to reflect the new directory name. This keeps the delta spec focused and avoids losing unrelated spec content at archive time.

**Decision: Use MODIFIED, not REMOVED + ADDED.**
The `.agents/skills/` reference is being replaced by `.skills/` within the same requirement. Using MODIFIED preserves the requirement structure and scenario format while updating the paths.

## Risks / Trade-offs

**Risk:** Delta spec only covers one requirement; other spec content remains unchanged.
→ **Mitigation:** This is intentional — the other requirements are still accurate. Only the directory scanning requirement needed updating.

## Migration Plan

No migration needed. The code change was already shipped in v1.43.0. This spec update is documentation-only.

## Open Questions

None.
