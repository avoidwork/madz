## 1. Implement the skill tool

- [x] 1.1 Add a `skill` tool to `src/tools/skills/index.js` that takes `{ name: string }`, looks up the skill via `registry.get(name)`, and returns the full body via `registry.getSkillBody(name)`.
- [x] 1.2 Enumerate supporting files (scripts/, references/, assets/) from `metadata._directory`, excluding SKILL.md, capped at ~10 entries, and include them in the return as `files`.
- [x] 1.3 Return a clear error for an unknown skill or a skill with no body path.

## 2. Register the tool

- [x] 2.1 Add `skill: ["filesystem:read"]` to `TOOL_PERMISSIONS` in `src/tools/index.js`.
- [x] 2.2 Add `skill` to `ORCHESTRATOR_TOOLS` in `src/tools/index.js`.
- [x] 2.3 Add the `skill` instance to the `TOOLS` map in `src/tools/index.js`.
- [x] 2.4 Add `skill` to `TOOL_CLASSIFICATIONS` for all 12 agent types (coding, search, debug, code-review, research, testing, documentation, security-audit, performance, textEditor, seoAnalyst, translator).

## 3. Remove the stopgap message

- [x] 3.1 Remove the "Skills are in your skills/ directory." suffix from the `pendingSilentMessageRef` string in `handleSelectProject` (`src/tui/app.js` line ~175).
- [x] 3.2 Remove the "Skills are in your skills/ directory." suffix from the `pendingSilentMessageRef` string in `handleClearProject` (`src/tui/app.js` line ~187).

## 4. Tests

- [x] 4.1 Add `tests/unit/tools/skills/skill.test.js` covering: returns the full SKILL.md body for a registered skill, returns a clear error for an unknown skill, handles a skill with no body path, and populates `files` for a skill with a scripts/ directory.

## 5. Verify

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
