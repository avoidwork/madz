## Context

`madz` uses `marked@9.1.6` with `marked-terminal@7.3.0` to render markdown as ANSI terminal text in its TUI (Ink-based). The `marked-terminal` package is unmaintained since October 2024 and its renderer code relies on `renderer.space()` which was removed in `marked` 10, causing a runtime crash. This pins `madz` to an outdated `marked` version, missing years of security fixes and improvements.

The markdown rendering is isolated to a single file: `src/tui/markdownText.js`. No other code paths reference `marked` or `marked-terminal`.

## Goals / Non-Goals

**Goals:**
- Replace `marked-terminal` with a custom `TerminalRenderer` class extending `marked.Renderer`
- Upgrade `marked` to 15.x (latest stable)
- Achieve full visual parity with `marked-terminal`'s output
- Add `node-emoji` and `supports-hyperlinks` as direct dependencies
- Maintain the existing `parseMarkdown()` API surface

**Non-Goals:**
- Migrating to a different markdown parser (markdown-it, etc.)
- Adding new markdown syntax beyond what `marked` 15.x supports
- Supporting non-ANSI terminal output
- Refactoring the TUI or Ink integration

## Decisions

1. **Custom Renderer vs. Fork**: Build a custom renderer rather than forking `marked-terminal`. The fork would require maintaining a dead project; a custom renderer is self-contained and can evolve independently.

2. **Chalk for ANSI styling**: Use `chalk` (already a transitive dependency via `marked-terminal`) for all ANSI styling. This provides configurable styles matching `marked-terminal`'s `defaultOptions` pattern without adding new dependencies.

3. **cli-highlight for code blocks**: Use `cli-highlight` (already transitive) for syntax highlighting in code blocks, with `chalk.level === 0` fallback for color-disabled environments.

4. **cli-table3 for tables**: Use `cli-table3` (already transitive) for cell alignment, borders, and multi-line cell support.

5. **node-emoji for emoji rendering**: Add as a direct dependency. Converts `:emoji-name:` syntax to actual emoji characters.

6. **supports-hyperlinks for hyperlink detection**: Add as a direct dependency. Detects terminal hyperlink support and wraps links with `ansi-escapes.link()`.

7. **ANSI-aware text reflow**: Implement custom reflow that strips ANSI escape codes before measuring string length, then re-applies them. This is critical for correct terminal wrapping.

8. **Hard vs soft line breaks**: Use `\r` for hard breaks (no reflow) and `\n` for soft breaks (reflow allowed). In GFM mode, also treat `<br />` as hard breaks.

9. **Colon escaping in code spans**: Replace `:` with a sentinel (`*#COLON|*`) before emoji processing in code spans, then restore after. Prevents false emoji matches on colons inside code.

## Risks / Trade-offs

- **Output format changes**: The rendered output will use different ANSI sequences than `marked-terminal`. Tests that assert on React element structure (not raw output) should survive. Tests that assert on specific ANSI sequences will need updating.
  → Mitigation: Review and update `tests/unit/tui.test.js` accordingly.

- **Reflow edge cases**: Complex ANSI escape sequences in formatted text could cause reflow miscalculations.
  → Mitigation: Use `ansi-regex` for reliable escape code stripping; test with worst-case ANSI-heavy input.

- **Table rendering differences**: `cli-table3` may produce slightly different border characters or cell padding than `marked-terminal`'s approach.
  → Mitigation: Accept minor visual differences; the spec-driven approach ensures all requirements are met.

- **Emoji performance**: Emoji lookup via `node-emoji` on every text pass could add overhead.
  → Mitigation: The existing LRU cache in `parseMarkdown()` already mitigates repeated parsing; emoji processing is part of the parse pipeline.

## Migration Plan

1. Create the custom `TerminalRenderer` class in `src/tui/markdownText.js`
2. Replace `markedTerminal()` import and `setOptions()` call with the new renderer
3. Update `package.json`: remove `marked-terminal`, upgrade `marked` to 15.x, add `node-emoji` and `supports-hyperlinks`
4. Run tests and fix any failures
5. Verify `npm start` doesn't crash
6. Commit and push via PR

## Open Questions

- None. The issue provides a complete implementation sketch with all renderer methods.
