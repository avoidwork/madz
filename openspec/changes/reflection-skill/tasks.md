## 1. Create skill directory structure

- [x] 1.1 Create `skills/reflection/` directory

## 2. Write SKILL.md definition

- [x] 2.1 Write YAML frontmatter with name, description, permissions (filesystem:read for sessions, filesystem:write for reflection.md)
- [x] 2.2 Write step-by-step instructions: discover session files from `memory/sessions/`, filter by 7-day window using frontmatter `startedAt`, sort descending by most recent
- [x] 2.3 Write instructions for generating the narrative summary: capture mood, energy, and interaction quality without granular technical detail
- [x] 2.4 Write instructions for writing output to `memory/context/reflection.md` with `updatedDate` and `timestamp` frontmatter fields (both set to current ISO time)
- [x] 2.5 Write guardrails: handle edge cases (no sessions found, empty sessions dir, no frontmatter), cap output at ~200-400 words, enforce 5 kB / 20k token hard limit, always write a file (never skip)

## 3. Verify

- [x] 3.1 Verify SKILL.md has required frontmatter fields (`name`, `description`) matching `SkillMetadataSchema`
- [x] 3.2 Verify the skill's `filesystem:read` permission scope covers `memory/sessions/` and `memory/context/`
- [x] 3.3 Verify the skill's `filesystem:write` permission scope covers `memory/context/`
- [x] 3.4 Verify that `memory/context/reflection.md` would be picked up by `loadContext()` (it has a `timestamp` frontmatter)
