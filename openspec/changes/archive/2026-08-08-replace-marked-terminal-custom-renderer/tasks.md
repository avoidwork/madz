## 1. Setup Dependencies

- [ ] 1.1 Update package.json: remove marked-terminal, upgrade marked to 15.x, add node-emoji and supports-hyperlinks as direct dependencies
- [ ] 1.2 Run npm install to update lockfile and verify dependency tree

## 2. Implement Core Renderer Infrastructure

- [ ] 2.1 Create ANSI-aware text utilities: textLength() (strip ANSI before measuring), unescapeEntities(), escapeColon()/undoColon()
- [ ] 2.2 Implement text reflow: reflowText() with ANSI awareness, hard/soft break distinction, GFM br handling
- [ ] 2.3 Implement list helpers: fixNestedLists(), bulletPointLines(), numberedLines(), list()
- [ ] 2.4 Implement indentation helpers: indentify(), indentLines()
- [ ] 2.5 Implement emoji helper: insertEmojis() using node-emoji
- [ ] 2.6 Implement table helper: generateTableRow() for cli-table3 integration

## 3. Implement TerminalRenderer Class

- [ ] 3.1 Create TerminalRenderer class extending marked.Renderer with constructor, defaultOptions, and config handling
- [ ] 3.2 Implement heading() with section prefix and configurable styling
- [ ] 3.3 Implement paragraph() with inline parsing and optional reflow
- [ ] 3.4 Implement strong(), em(), del(), codespan() with configurable styles
- [ ] 3.5 Implement code() with cli-highlight syntax highlighting and chalk.level fallback
- [ ] 3.6 Implement blockquote() with indentation and styling
- [ ] 3.7 Implement link() with ansi-escapes hyperlink support and sanitize handling
- [ ] 3.8 Implement image() with fallback text format
- [ ] 3.9 Implement list() and listitem() with checkbox support
- [ ] 3.10 Implement checkbox() returning [X] or [ ]
- [ ] 3.11 Implement table() with cli-table3 integration
- [ ] 3.12 Implement tablerow() and tablecell() for cli-table3 format
- [ ] 3.13 Implement hr() with terminal-width dash line
- [ ] 3.14 Implement br() with hard/soft break handling
- [ ] 3.15 Implement html() and text() passthrough methods
- [ ] 3.16 Implement unescape() method

## 4. Integrate with markdownText.js

- [ ] 4.1 Replace marked-terminal import with custom TerminalRenderer
- [ ] 4.2 Replace markedTerminal() call and setOptions() with createTerminalRenderer()
- [ ] 4.3 Export createTerminalRenderer() factory function
- [ ] 4.4 Ensure parseCache and parseMarkdown() API surface remains unchanged

## 5. Update Tests

- [ ] 5.1 Review tests/unit/tui.test.js for MarkdownTextInner assertions (lines 803-836)
- [ ] 5.2 Update any test assertions that depend on specific ANSI output format
- [ ] 5.3 Add tests for new renderer methods if coverage gaps exist

## 6. Verify and Lint

- [ ] 6.1 Run npm run lint to verify code passes oxlint and oxfmt checks
- [ ] 6.2 Run npm run test to verify all tests pass
- [ ] 6.3 Run npm start with timeout to verify application doesn't crash
- [ ] 6.4 Run npm run coverage to verify coverage is maintained

## 7. Commit and Push

- [ ] 7.1 Stage all changes (package.json, src/tui/markdownText.js, tests, openspec files)
- [ ] 7.2 Commit with conventional commit format
- [ ] 7.3 Push branch to remote
- [ ] 7.4 Create or update PR targeting main
