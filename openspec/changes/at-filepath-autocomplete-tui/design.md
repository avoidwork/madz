## Context

The TUI input panel (`src/tui/inputPanel.js`) is a thin wrapper around `ink-text-input` that captures user text input. Users frequently reference files in conversations but must manually type full or partial paths, which is error-prone. The Ink framework does not support z-index overlays, so any dropdown must be rendered as a sibling component.

## Goals / Non-Goals

**Goals:**
- Detect `@` trigger character in the input field and enter autocomplete mode.
- Perform glob-based file search in the project root for matching paths.
- Render a dropdown list below the input line with keyboard navigation.
- Replace `@<query>` with the selected file path on Enter.
- Render the selected filename portion in cyan/green using chalk.
- Manage autocomplete state in the App component and pass it to InputPanel.

**Non-Goals:**
- Tab completion or other trigger characters.
- Fuzzy search beyond prefix matching.
- Autocomplete in non-input contexts.
- Caching of glob results across sessions.
- Inline completion (VS Code-style).

## Decisions

1. **Trigger character: `@`** — Chosen over tab because tab is already used for other purposes in some terminals. `@` is more discoverable and less likely to conflict with existing keybindings.

2. **Glob search via `fast-glob`** — Chosen over a custom recursive `fs.readdirSync` walk because fast-glob handles edge cases (symlinks, hidden files, permission errors) more robustly. The dependency is lightweight (~100KB).

3. **Dropdown as sibling component** — Ink does not support true overlays or z-index. The autocomplete dropdown is rendered as a conditional sibling below InputPanel and above StatusBar, avoiding pushing status bar content.

4. **Keyboard interception in InputPanel** — Autocomplete mode intercepts arrow keys (up/down) and Enter before `ink-text-input` processes them. Esc dismisses the dropdown. When not in autocomplete mode, all keys pass through to TextInput normally.

5. **State lifted to App component** — Autocomplete state (`inAutocomplete`, `query`, `matches`, `selectedIndex`) lives in the App component and is passed as props to InputPanel. This keeps the state co-located with other TUI state and simplifies prop drilling.

6. **Cyan/green color for selected filename** — Chalk v6.0.0 is already a dependency. The selected filename portion is wrapped in a chalk color wrapper within the input display, splitting the input value into segments.

## Risks / Trade-offs

- **[Risk]** `fast-glob` adds a new dependency. → **Mitigation:** fast-glob is a well-maintained, widely-used package with minimal footprint.
- **[Risk]** Ink rendering order may cause the dropdown to appear behind other components. → **Mitigation:** Render dropdown between InputPanel and StatusBar in the Box hierarchy.
- **[Risk]** Keyboard interception may break existing TextInput behavior. → **Mitigation:** Only intercept keys when `inAutocomplete` is true; otherwise pass all keys through to TextInput.
- **[Risk]** Glob search on every keystroke may be slow for large projects. → **Mitigation:** Debounce search by 150ms; limit results to top 5 matches.

## Migration Plan

No migration needed. This is a pure addition — no existing functionality is modified or removed.

## Open Questions

- Should the autocomplete search be scoped to specific file extensions (e.g., `.js`, `.ts`, `.md`) or include all files? Default: all files.
- Should the search exclude `node_modules`, `.git`, and other common ignore directories? Default: yes, follow `.gitignore` patterns.
