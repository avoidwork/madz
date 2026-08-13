## Context

The TUI input panel (`src/tui/inputPanel.js`) currently uses `ink-text-input` for basic text entry. Users must manually type full file paths when referencing files in their messages. The project root is at the git repository root, and `.gitignore` patterns should be respected when scanning files.

## Goals / Non-Goals

**Goals:**
- Implement @-triggered file path autocomplete overlay in the TUI input panel
- Provide fuzzy text filtering against project files
- Support arrow key navigation and Enter/Escape selection
- Track cursor position to insert paths at the correct input position
- Cache file list after initial scan with configurable TTL
- Respect `.gitignore` patterns during file scanning

**Non-Goals:**
- Directory navigation within the autocomplete
- File content preview
- Autocomplete for commands or skills
- Network/remote file suggestions
- Configurable trigger character
- Multi-selection support

## Decisions

### Decision 1: Overlay Component vs Inline Autocomplete
**Choice:** Render a separate overlay component positioned above the input bar, not inline within the text.
**Rationale:** Ink's rendering model makes inline completion within `ink-text-input` difficult — the component manages its own cursor and rendering. An overlay positioned via absolute coordinates avoids fighting with `ink-text-input`'s internal state. The overlay renders as a `Box` with a scrollable list using `ink-scroll-view`.
**Alternatives considered:**
- Inline completion: Would require wrapping `TextInput` with custom rendering logic, fragile across ink versions.
- Dropdown below input: Less discoverable; overlay above keeps the input context visible.

### Decision 2: File Scanning Strategy
**Choice:** Recursive `fs.readdirSync` with `.gitignore` pattern matching, cached with TTL.
**Rationale:** The project uses Node.js built-in `fs` module. A simple glob pattern matcher handles `.gitignore` patterns (no external dependency needed). Caching avoids repeated scans on each `@` trigger. TTL of 30 seconds balances freshness with performance.
**Alternatives considered:**
- `find` command: Faster but platform-dependent.
- No caching: Unacceptable performance for large repos.
- Watch-based invalidation: Overly complex for this scope.

### Decision 3: Fuzzy Matching Algorithm
**Choice:** Case-insensitive substring matching with score weighting (prefix matches score higher).
**Rationale:** Simple, fast, and sufficient for file path matching. Prefix matches (e.g., "src/tui" matching "src/tui/inputPanel.js") rank higher than mid-string matches. No external fuzzy library needed.
**Alternatives considered:**
- Fuse.js: Full fuzzy matching but adds dependency.
- Exact substring only: Too restrictive for partial path entry.

### Decision 4: Cursor Position Tracking
**Choice:** Maintain a separate cursor position state in the input panel, updated via `onChange` callback.
**Rationale:** `ink-text-input` does not expose cursor position directly. We track it by maintaining the full input string and using the `onChange` callback to detect position changes. The `onChange` callback from `ink-text-input` provides the new value; we track cursor position separately via a ref.
**Alternatives considered:**
- Parse cursor from input text: Impossible — `ink-text-input` doesn't expose it.
- Use a different input component: Unnecessary complexity.

### Decision 5: File List Filtering
**Choice:** Filter files by extension whitelist (configurable) and directory blacklist.
**Rationale:** Users typically want source files, not binary assets or node_modules. Default whitelist: `.js`, `.ts`, `.json`, `.yaml`, `.yml`, `.md`, `.txt`, `.css`, `.html`, `.mjs`, `.cjs`. Directory blacklist: `node_modules`, `.git`, `dist`, `build`.
**Alternatives considered:**
- Show all files: Overwhelming in large repos.
- Only show files in current directory: Too restrictive.

## Risks / Trade-offs

### Risk: Large repository performance
**Mitigation:** File list is cached with 30s TTL. Initial scan is async and shows a loading indicator. Max file count capped at 5000 entries.

### Risk: Overlay rendering conflicts with Ink's virtual DOM
**Mitigation:** The overlay is a sibling component to the input panel, rendered in the same React tree. Ink handles overlapping boxes via absolute positioning. Test with various terminal sizes.

### Risk: Cursor position tracking accuracy
**Mitigation:** Track cursor position via a ref updated on every `onChange` event. Use `ink-text-input`'s built-in cursor tracking where available. Fall back to end-of-string position.

### Risk: `.gitignore` parsing edge cases
**Mitigation:** Use a well-tested `.gitignore` parser pattern. Handle negation patterns (`!`), directory-only patterns (trailing `/`), and comments. Test with the project's own `.gitignore`.

## Migration Plan

1. Add `fileAutocomplete` spec to `openspec/specs/`
2. Create `src/tui/fileAutocomplete.js` component
3. Modify `src/tui/inputPanel.js` to detect `@` trigger and render overlay
4. Modify `src/tui/app.js` to manage autocomplete state and key routing
5. Add tests in `tests/unit/tui/fileAutocomplete.test.js`
6. Update `tui-interface` spec with new requirements
7. Update `tui-event-routing` spec with autocomplete key handling

## Open Questions

- Should the file list be sorted by relevance (match position) or alphabetically?
- Should there be a config option to disable the feature?
- How should symlinks be handled — follow or skip?
