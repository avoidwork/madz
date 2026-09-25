## Context

The `/skills` TUI view was reported to render descriptions without skill names (issue #1170). The visible symptom is not reproduced by the current code — `src/tui/skillsPanel.js` does render `skill.name` on its own line above the description. The symptom is most consistent with a stale TUI process or terminal width. However, the root-cause analysis surfaced two genuine latent bugs in the skill discovery/registry pipeline that would produce this class of symptom if triggered:

1. **Weak frontmatter delimiter extraction** (`src/skills/discoverer.js`): `extractFrontmatter()` uses `content.split("---")`, a global split on every `---` in the file. Many `SKILL.md` files contain `---` in their body (Markdown table separators, horizontal rules), so the split produces many parts and `parts[1]` only captures text between the first and second `---`. If a `---` appears inside the frontmatter region, the frontmatter is truncated mid-field.

2. **Name drift** (`src/skills/registry.js`): `SkillRegistry.discover()` sets `entry.name = skill.metadata.name` (frontmatter) but uses `skill.name` (directory name) as the Map key. If the two diverge, the catalog shows the frontmatter name while `registry.list()` and the command parser match against the directory name, causing `/skills` selection to produce a command that doesn't resolve.

## Goals / Non-Goals

**Goals:**
- Make frontmatter extraction precise and immune to `---` appearing in the body.
- Make the directory name the canonical skill identifier, surfacing name drift as a warning.
- Add unit tests for both fixes and a render regression test for `SkillsPanel`.

**Non-Goals:**
- Changing the `SkillsPanel` render logic — the visible symptom is not reproduced by the current code.
- Changing the YAML schema or validation rules.
- Modifying the `register()`/`unregister()` paths beyond what is needed for the name-drift fix.
- Addressing the unquoted `description` values containing `: ` (a real but separate bug; the lenient YAML fallback handles it gracefully).

## Decisions

### Decision 1: Regex-anchored frontmatter extraction

Replace `content.split("---")` with the regex `/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/` anchored to the file start. This captures the frontmatter block precisely and is immune to `---` in the body.

**Alternatives considered:**
- Keep `split("---")` and only take `parts[1]` — rejected because it truncates frontmatter when `---` appears inside the frontmatter region and corrupts body reconstruction.
- Use a line-by-line state machine — rejected as more complex than needed; the anchored regex is sufficient and matches the issue's prescribed fix.

The body is reconstructed from the remainder of the content after the closing delimiter. The existing lenient YAML fallback (`lenientYamlParse`) is preserved unchanged.

### Decision 2: Directory name as canonical identifier

Make `entry.name` always use the directory name (`skill.name`) as the canonical kebab-case identifier. The Map key already uses `skill.name`; aligning `entry.name` with it ensures the catalog, `registry.list()`, and the command parser all agree on the identifier. When the frontmatter `name` drifts from the directory name, emit a warning in the registration result and in the entry's `warnings` array.

**Alternatives considered:**
- Keep `entry.name = skill.metadata.name` — rejected because it diverges from the Map key and the command parser, producing commands that don't resolve.
- Use the frontmatter name as canonical — rejected because the directory name is the stable, filesystem-derived key used by the registry Map and command parser.

## Risks / Trade-offs

- **[Frontmatter regex edge cases]** → The regex handles CRLF (`\r\n`) and a missing trailing newline after the closing delimiter via the `(\r?\n|$)` alternation. Content with no valid frontmatter block returns `{ frontmatter: null, body: content.trim() }`, preserving existing behavior.
- **[Name drift warning noise]** → The warning is surfaced only when the frontmatter `name` actually differs from the directory name; skills with matching names produce no warning, so existing behavior is unchanged for well-formed skills.
- **[Behavior change for drifted skills]** → Skills whose frontmatter `name` differs from their directory name will now be cataloged under the directory name. This is the intended fix — it makes `/skills` selection resolve correctly — but it is a behavior change for any skill that relied on the frontmatter name being surfaced.
