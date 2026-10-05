## Context

The TUI status bar (`src/tui/statusBar.js`) renders the left side as a row of `Text` elements, each currently wrapped in `[ ]` brackets. The rendering order is `[model] [⚡skills] [💬messages] [▦context] [💎tokens] [project]`. The `formatSize` helper currently does locale formatting only and is used exclusively for the context size (`▦`) element. The `formatNumber` helper is used for skills, messages, and tokens.

This change is purely cosmetic — it reduces visual clutter on the left side of the status bar without changing any behavior or configuration.

## Goals / Non-Goals

**Goals:**
- Replace `[ ]` brackets with light floating dot (`∙`, U+2219) separators.
- The model name (first element after the streaming indicator) gets no dot; every subsequent element gets a `∙` to its left.
- Space out unicode glyphs from their following numbers (e.g., `⚡ 12`).
- Apply SI postfix to context-window and token-budget numbers only (`▦`, `💎`).

**Non-Goals:**
- No change to the right side (version, quote).
- No change to the streaming indicator.
- No change to per-item visibility configuration (`tui.statusBar` booleans).
- No new dependencies.

## Decisions

### Decision 1: Update `formatSize` to be the SI postfix formatter
`formatSize` is used only for the context size element. Updating it to produce SI postfix (e.g., `12.2k`, `1.4M`) is a localized, safe change. It is reused for the token count/budget element to avoid a second near-identical helper.

- **Alternative considered:** Add a separate `formatSI` helper and leave `formatSize` as-is. Rejected because `formatSize` has a single caller (context size) and reusing it for tokens keeps the code DRY.

### Decision 2: Model gets no dot
The model is the first element after the streaming indicator and is the anchor of the left side. All subsequent elements get a `∙` separator. This matches the requirement that the model name is the first element and gets no dot.

### Decision 3: Dot-space-glyph pattern
Each element after the model renders as `∙ ` + glyph + ` ` + value (e.g., `∙ ⚡ 12`). The dot is not glued to the glyph. This is explicitly required by the issue.

### Decision 4: SI postfix only for context and tokens
Skills (`⚡`) and messages (`💬`) keep plain counts via `formatNumber`. Only context-window-centric numbers (context size, token budget) get SI postfix. This matches the requirement.

## Risks / Trade-offs

- **[Risk] `∙` (U+2219) is visually similar to the `∙∙∙` streaming indicator.** → Mitigation: the separator is a single dot followed by a space, while the streaming indicator is three dots. They remain distinguishable.
- **[Risk] Changing `formatSize` from locale formatting to SI postfix is a behavior change.** → Mitigation: it is confined to the status bar context/token display and covered by updated tests. `formatSize` has a single caller.
- **[Risk] Existing tests assert the bracket-based layout.** → Mitigation: update `tests/unit/tui/statusBar.test.js` and `tests/unit/statusBar.test.js` to assert the new layout.
