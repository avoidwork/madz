
## Decisions

### 1. Cursor color strategy
**Decision:** The cursor will always render in cyan (`"cyan"`) regardless of text color. The `cursorColor` prop will be repurposed to control text color only.

**Rationale:** The current approach of making the cursor the same color as text makes it invisible. A fixed cyan cursor provides consistent visibility.

**Alternatives considered:**
- Auto-detect text color and choose a contrasting cursor color — adds complexity, fragile.
- Make cursor color configurable per-message — overkill for a CLI.

### 2. Auto-scroll via useEffect with ref
**Decision:** Replace the render-phase hash check + `scrollToBottom()` with a `useEffect` that watches `messages` and `scrollRef.current`.

**Rationale:** Side effects during render violate React's rendering model. A `useEffect` with proper dependencies achieves the same result cleanly.

**Alternatives considered:**
- Keep the hash check but move it to `useLayoutEffect` — still runs during render phase. `useEffect` is the correct choice for scroll side effects.

### 3. Remove wrap: "hard" from MarkdownText
**Decision:** Remove the `wrap: "hard"` prop from the `Text` component wrapping parsed markdown.

**Rationale:** `marked-terminal` already produces terminal-width-wrapped output. Adding `wrap: "hard"` causes double-wrapping that produces incorrect line breaks.

**Alternatives considered:**
- Keep `wrap: "hard"` but add logic to detect if content is already wrapped — fragile.
- Use `wrap: "wrap"` — redundant since output is already wrapped.

### 4. Cache parseMarkdown results
**Decision:** Use `useRef` to cache the parsed markdown result keyed by content hash.

**Rationale:** `marked.parse()` is synchronous but non-trivial for long messages. Caching avoids unnecessary work on re-renders.

**Alternatives considered:**
- Use `useMemo` — not guaranteed to persist in all React modes. `useRef` is more reliable.
- Cache at module level — shared across instances, risky if content differs.

### 5. Guard scroll methods with interactive check
**Decision:** Check `stdout.isTTY` before calling scroll methods.

**Rationale:** Guarding scroll methods with `isTTY` prevents errors in CI/piped environments.

**Alternatives considered:**
- Try/catch around scroll calls — masks real errors.
- Check `process.env.CI` — doesn't cover all non-TTY scenarios.

## Risks / Trade-offs

**Risk:** Changing cursor color from white to cyan may look inconsistent with the user's custom color scheme.
**Mitigation:** The cursor was invisible before. Cyan is a standard terminal cursor color and will be visible against any background.

**Risk:** Removing `wrap: "hard"` could cause very long unbroken strings (e.g., URLs) to overflow the terminal width.
**Mitigation:** `marked-terminal` already handles this via its own wrapping logic. If needed, `overflowX: "hidden"` can be added to the parent Box as a separate concern.

**Risk:** Moving auto-scroll to `useEffect` changes timing — scroll happens after render instead of during.
**Mitigation:** The visual difference is imperceptible. The scroll will happen on the next paint, which is the correct React pattern.

## Migration Plan

This is a pure code fix with no API changes, no config changes, and no data migration. The changes are:
1. Delete dead code from `inputPanel.js` and `conversationPanel.js`
2. Update `Blink` component to use fixed cyan cursor
3. Move auto-scroll logic to `useEffect` in `ConversationPanel`
4. Remove `wrap: "hard"` from `MarkdownText`
5. Add parse caching to `MarkdownText`
6. Add `isTTY` guard to scroll calls in `ConversationPanel`
7. Fix `dim` to `dimColor` in `MessageBubble`

No rollback needed — if issues arise, revert the commit.

## Open Questions

- None. All 12 audit findings have clear remediation paths.
