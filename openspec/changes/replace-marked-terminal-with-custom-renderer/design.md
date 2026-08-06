## Context

The project uses `marked@9.1.6` with `marked-terminal@7.3.0` to render markdown as ANSI terminal text in the Ink-based TUI. `marked-terminal` is unmaintained since October 2024 and its renderer relies on `renderer.space()`, removed in `marked` 10+. The project cannot upgrade `marked` without replacing the renderer.

## Goals / Non-Goals

**Goals:**
- Replace `marked-terminal` with a custom `TerminalRenderer` extending `marked.Renderer`
- Upgrade `marked` to 15.x (latest stable)
- Maintain full visual parity with existing `marked-terminal` output
- Keep the `parseMarkdown()` API unchanged

**Non-Goals:**
- Performance optimization of the renderer
- Adding new markdown syntax support
- Changes to other TUI panels
- Changes to OpenSpec tooling

## Decisions

1. **Custom renderer over alternative parsers** — `markdown-it` would require rewriting the entire markdown pipeline. Staying with `marked` preserves compatibility with existing markdown content and the existing `marked.setOptions()` integration pattern.

2. **Chalk for ANSI styling** — `chalk` is already a transitive dependency via `marked-terminal`. Using it directly avoids new dependencies and maintains the same visual output.

3. **Keep existing transitive dependencies as direct deps** — `cli-highlight`, `cli-table3`, `ansi-escapes`, `ansi-regex` are already used by `marked-terminal`. They become direct dependencies. `node-emoji` and `supports-hyperlinks` are also pulled in by `marked-terminal` and become direct dependencies.

4. **Single-file integration** — `src/tui/markdownText.js` is the only file importing `marked` and `marked-terminal`. The custom renderer replaces the `markedTerminal()` call and `setOptions()` call in this single file.

5. **Default options matching marked-terminal** — The `TerminalRenderer` constructor accepts an `options` object with the same shape as `marked-terminal`'s `defaultOptions`, ensuring backward compatibility.

## Risks / Trade-offs

- **Maintenance burden** — A custom renderer must be maintained and tested against future `marked` versions. → Mitigation: The renderer is a thin adapter; `marked`'s stable `Renderer` API changes infrequently.
- **Test output changes** — Existing tests assert on React element structure, not rendered strings, so they should survive the swap. → Mitigation: Run full test suite; update only if assertions break.
- **Emoji/hyperlink edge cases** — New features (emoji, hyperlinks) may behave differently in edge cases (unsupported terminals, malformed emoji names). → Mitigation: Graceful fallbacks (plain text for unsupported emoji, no hyperlink for unsupported terminals).

## Migration Plan

1. Install new dependencies (`node-emoji`, `supports-hyperlinks`), remove `marked-terminal`
2. Upgrade `marked` to 15.x
3. Implement `TerminalRenderer` in a new file or inline in `markdownText.js`
4. Replace `markedTerminal()` call with `new TerminalRenderer()`
5. Run tests, fix any regressions
6. Verify visual output parity with existing `marked-terminal` output

## Open Questions

- None. The issue provides a complete implementation sketch.
