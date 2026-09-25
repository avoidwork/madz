## ADDED Requirements

### Requirement: Frontmatter extraction anchored to file start

The system SHALL extract YAML frontmatter from `SKILL.md` content using a regex anchored to the file start (`/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/`), so that the frontmatter block is captured precisely and is immune to `---` delimiters appearing in the body (Markdown table separators, horizontal rules). The extracted body SHALL be the content following the closing delimiter.

#### Scenario: Frontmatter with `---` in the body is extracted correctly

- **WHEN** a `SKILL.md` file has a frontmatter block followed by a body that contains `---` (e.g., a Markdown table separator or horizontal rule)
- **THEN** the frontmatter is extracted as the complete block between the first and second `---` lines, and the body retains the `---` occurrences

#### Scenario: Frontmatter with `---` inside the frontmatter region is not truncated

- **WHEN** a `SKILL.md` file has a `---` line inside the frontmatter region
- **THEN** the frontmatter is not truncated mid-field and the full frontmatter block is parsed

#### Scenario: Content without a valid frontmatter block returns null

- **WHEN** a `SKILL.md` file has no `---` delimiters at the file start or no closing delimiter
- **THEN** `extractFrontmatter` returns `{ frontmatter: null, body: content.trim() }`

#### Scenario: CRLF line endings are handled

- **WHEN** a `SKILL.md` file uses CRLF (`\r\n`) line endings
- **THEN** the frontmatter is still extracted correctly

#### Scenario: Frontmatter with no trailing newline after closing delimiter

- **WHEN** a `SKILL.md` file's closing `---` delimiter is the last line with no trailing newline
- **THEN** the frontmatter is still extracted correctly
