## 1. Install Dependencies

- [ ] 1.1 Remove `marked-terminal` from package.json dependencies
- [ ] 1.2 Upgrade `marked` from 9.1.6 to 15.x (latest stable)
- [ ] 1.3 Add `node-emoji` as direct dependency
- [ ] 1.4 Add `supports-hyperlinks` as direct dependency
- [ ] 1.5 Run `npm install` and verify no errors

## 2. Implement Custom Terminal Renderer

- [ ] 2.1 Create `src/tui/terminalRenderer.js` with the `TerminalRenderer` class extending `marked.Renderer`
- [ ] 2.2 Implement utility functions: `textLength`, `unescapeEntities`, `escapeColon`, `undoColon`
- [ ] 2.3 Implement text reflow function with ANSI awareness and hard/soft break handling
- [ ] 2.4 Implement nested list handling: `fixNestedLists`, `bulletPointLines`, `numberedLines`, `list`
- [ ] 2.5 Implement emoji insertion function with colon escaping
- [ ] 2.6 Implement `TerminalRenderer` constructor with options merging and default options
- [ ] 2.7 Implement heading renderer (h1-h6) with section prefix and configurable styling
- [ ] 2.8 Implement paragraph renderer with optional text reflow
- [ ] 2.9 Implement strong, em, codespan renderers
- [ ] 2.10 Implement code block renderer with syntax highlighting via cli-highlight
- [ ] 2.11 Implement blockquote renderer with indentation
- [ ] 2.12 Implement link renderer with hyperlink support via ansi-escapes
- [ ] 2.13 Implement image renderer with fallback text format
- [ ] 2.14 Implement list renderer with nested list support
- [ ] 2.15 Implement listitem renderer with task checkbox support
- [ ] 2.16 Implement checkbox renderer ([X] / [ ])
- [ ] 2.17 Implement table renderer using cli-table3 with cell alignment and borders
- [ ] 2.18 Implement tablerow and tablecell helper methods
- [ ] 2.19 Implement hr renderer with terminal width spanning
- [ ] 2.20 Implement del (strikethrough), br, html, text, unescape renderers
- [ ] 2.21 Implement `fixHardReturn` and `indentify` helper functions
- [ ] 2.22 Implement `generateTableRow` helper for table parsing
- [ ] 2.23 Export `createTerminalRenderer` factory function

## 3. Integrate Renderer into markdownText.js

- [ ] 3.1 Remove `marked-terminal` import from `src/tui/markdownText.js`
- [ ] 3.2 Import the custom `TerminalRenderer` from `terminalRenderer.js`
- [ ] 3.3 Replace `markedTerminal()` call with `new TerminalRenderer()`
- [ ] 3.4 Verify `setOptions()` still works with the custom renderer
- [ ] 3.5 Verify `parseMarkdown()` function works correctly with the new renderer

## 4. Update OpenSpec Files

- [ ] 4.1 Commit and push OpenSpec files (proposal.md, design.md, tasks.md, specs/)
- [ ] 4.2 Ensure PR is created for the spec files

## 5. Test and Verify

- [ ] 5.1 Run `npm run test` and fix any failures
- [ ] 5.2 Run `npm run lint` and fix any lint errors
- [ ] 5.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 5.4 Manually verify markdown rendering output parity with previous marked-terminal output

## 6. Finalize

- [ ] 6.1 Commit implementation changes with conventional commit message
- [ ] 6.2 Push branch and update PR with implementation changes
- [ ] 6.3 Comment on issue #595 linking to the PR
