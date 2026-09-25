## Why

The `/skills` TUI view was reported to render descriptions without skill names (issue #1170). The visible symptom is not reproduced by the current code and is most consistent with a stale TUI process or terminal width. However, the root-cause analysis surfaced two genuine latent bugs in the skill discovery/registry pipeline that would produce this class of symptom if triggered: weak frontmatter delimiter extraction and name drift between frontmatter and directory name.

## What Changes

- **Fix frontmatter delimiter extraction** in `src/skills/discoverer.js`: replace `content.split("---")` with a regex anchored to the file start (`/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/`) so frontmatter is extracted precisely and is immune to `---` appearing in the body (Markdown table separators, horizontal rules).
- **Fix name drift** in `src/skills/registry.js`: make `entry.name` always use the directory name (`skill.name`) as the canonical kebab-case identifier, and emit a warning when the frontmatter `name` drifts from the directory name.
- **Add unit tests**: `tests/unit/skills/discoverer.test.js` (extractFrontmatter with `---` in the body) and `tests/unit/skills/registry.test.js` (name drift).
- **Add render regression test** to `tests/unit/tui/skillsPanel.test.js` asserting the rendered output contains the skill name, not just the description.

## Capabilities

### New Capabilities

- `skills-frontmatter-extraction`: Precise extraction of YAML frontmatter from `SKILL.md` anchored to the file start, immune to `---` delimiters appearing in the body.

### Modified Capabilities

- `skills-registry`: The registry now uses the directory name as the canonical skill identifier, emitting a warning when the frontmatter `name` drifts from the directory name.

## Impact

- **Affected code:** `src/skills/discoverer.js`, `src/skills/registry.js`, and their tests (`tests/unit/skills/discoverer.test.js`, `tests/unit/skills/registry.test.js`, `tests/unit/tui/skillsPanel.test.js`).
- **No dependency changes.**
- **Behavior change:** Frontmatter extraction is now robust to `---` in the body; the registry catalog and `registry.list()` surface the canonical directory name, and name drift is surfaced as a warning.

## Non-goals

- Changing the `SkillsPanel` render logic — the visible symptom is not reproduced by the current code.
- Changing the YAML schema or validation rules.
- Modifying the `register()`/`unregister()` paths beyond what is needed for the name-drift fix.
- Addressing the unquoted `description` values containing `: ` (a real but separate bug; the lenient YAML fallback handles it gracefully).
