## 1. Fix frontmatter extraction (skills-frontmatter-extraction)

- [x] 1.1 Replace the `content.split("---")` logic in `extractFrontmatter()` in `src/skills/discoverer.js` with the regex `/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/` anchored to the file start
- [x] 1.2 Preserve the existing lenient YAML fallback (`lenientYamlParse`) and the `{ frontmatter: null, body: content.trim() }` behavior for content without a valid frontmatter block
- [x] 1.3 Add unit tests in `tests/unit/skills/discoverer.test.js` covering `extractFrontmatter()` with `---` in the body, `---` inside the frontmatter region, CRLF line endings, and no trailing newline after the closing delimiter

## 2. Fix name drift (skills-registry)

- [x] 2.1 In `SkillRegistry.discover()` in `src/skills/registry.js`, set `entry.name` to the directory name (`skill.name`) as the canonical identifier instead of `skill.metadata.name`
- [x] 2.2 Emit a warning when the frontmatter `name` drifts from the directory name, surfacing it in the registration result and the entry's `warnings` array
- [x] 2.3 Add unit tests in `tests/unit/skills/registry.test.js` covering name drift between frontmatter and directory name

## 3. Add render regression test (skills-panel-name-render)

- [x] 3.1 Add a render regression test for `SkillsPanel` asserting the rendered output contains the skill name, not just the description

## 4. Verify

- [x] 4.1 Run `npm run test` and fix any failures
- [x] 4.2 Run `npm run lint` and fix any issues
- [x] 4.3 Run `npm run coverage` and confirm coverage is maintained
- [x] 4.4 Run `npm start` with a timeout to verify the app starts
