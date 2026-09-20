## Context

The TUI input bar (`src/tui/inputArea.js` + `src/tui/inputPanel.js`) currently uses `ink-text-input` for text entry. Users must type full file paths by hand. The `/skills` panel (`src/tui/skillsPanel.js`) already demonstrates the single-handler filter + navigation pattern that avoids the focus conflict between `ink-text-input` and `ink-select-input`. The `ink-select-input` visual pattern (`limit`, rotating window, `▸` indicator) is used by `src/tui/sessionsPanel.js` and `src/tui/memoryPanel.js`.

The feature is a self-contained input+list component that owns the input while open. This is the only clean way to support cursor movement without the focus conflict — Ink has no `stopPropagation`, so the `InputPanel` and the picker cannot both be active.

## Goals / Non-Goals

**Goals:**
- Add a self-contained `FilePicker` component in `src/tui/filePicker.js` that owns the input while open.
- Derive the autocomplete filter from the token at the cursor (cursor-aware), bounded by whitespace (unquoted) or quotes (quoted). Active only when the cursor is inside an `@` token.
- Glob the user's cwd with `fast-glob` using a fixed pattern `**/*`, ignoring `node_modules`, `.git`, and `dist`, with `onlyFiles: true` and a depth cap. Filter in JS (case-insensitive substring match) — never use the filter as a glob pattern.
- Debounce the glob at ~250ms on filter change and cache the initial glob result.
- Render up to 3 visible options, sorted alphabetically, with a rotating window and the `▸` indicator.
- On Enter, replace the `@` token (token start to token end) with the full selected path; wrap in quotes if the path contains whitespace.
- Wire the picker into `InputArea` (render below `InputPanel`, set `focus={false}` while open, expose `isPickerOpen()`), and bail in the App-level global `useInput`.
- Promote `fast-glob` from a transitive to a direct dependency.

**Non-Goals:**
- Handling escapes in paths — quotes are literal boundaries (documented limitation).
- Reading file contents — the picker lists files only (read-only).
- Changing issue labels.
- Any behavior outside the TUI input autocomplete.

## Decisions

### Decision 1: Path A (single handler) over Path B (real `ink-select-input` + separate filter handler)

The `/skills` panel already solves the focus conflict by using a single `useInput` handler for both filtering and navigation. Path B requires the focus juggling the codebase deliberately avoids. Ink has no `stopPropagation`, so only one handler can be active at a time. The picker owns the input while open.

**Alternatives considered:**
- **Path B (real `ink-select-input` + separate filter handler):** Rejected. Requires focus juggling between `ink-text-input` and `ink-select-input`, which the codebase deliberately avoids.

### Decision 2: Cursor-aware filter over end-of-input filter

The original filter derivation (text between last `@` and end of input) is a bug when the cursor moves. If the user types `@F` and moves the cursor left, the filter is wrong — and if the cursor moves left past the `@`, the slice becomes empty and the picker shows every file. The revised filter is the text between the last `@` and the cursor, bounded by whitespace (unquoted) or quotes (quoted). The autocomplete is active only when the cursor is inside an `@` token; if the cursor moves out of the token, the picker closes.

**Alternatives considered:**
- **End-of-input filter:** Rejected. Broken when the cursor moves.

### Decision 3: JS substring filter over glob filter

The filter is never interpolated into a glob pattern — it is only ever a case-insensitive substring match against the cached file list. This prevents glob-injection. The glob uses a fixed pattern `**/*` with ignores for `node_modules`, `.git`, and `dist`, `onlyFiles: true`, and a depth cap. The initial glob result is cached; re-filtering is a JS filter, not a re-glob.

**Alternatives considered:**
- **Using the filter as a glob pattern:** Rejected. Injection vector.

### Decision 4: No escape handling

Per the user's guidance, escapes are not handled. Quotes are treated as literal boundaries; a quote inside a path is not escaped. This is a documented limitation, not a bug.

### Decision 5: Debounce and cache

The glob is debounced at ~250ms on filter change to avoid re-rendering too fast. The initial glob result is cached so re-filtering is a JS filter, not a re-glob.

## Risks / Trade-offs

- **[Focus conflict]** → Mitigated by Path A: the picker owns the input while open; `InputPanel` gets `focus={false}`; App-level `useInput` bails via `isPickerOpen()`.
- **[Glob-injection]** → Mitigated by never interpolating the filter into a glob pattern; the filter is only a JS substring match.
- **[Cursor movement breaks filter]** → Mitigated by the cursor-aware token-boundary filter derivation.
- **[Large file trees]** → Mitigated by `onlyFiles: true`, depth cap, and ignoring `node_modules`/`.git`/`dist`.
- **[Quotes in paths not escaped]** → Documented limitation; quotes are literal boundaries.

## Migration Plan

No migration needed — this is a new feature. `fast-glob` is promoted from a transitive to a direct dependency via `npm install fast-glob`.

## Open Questions

None.
