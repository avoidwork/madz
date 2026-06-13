## Decisions

### 1. Cursor color strategy
**Decision:** The cursor will always render in cyan (`"cyan"`) regardless of text color. The `cursorColor` prop will be repurposed to control text color only.

**Rationale:** The current approach of making the cursor the same color as text makes it invisible. A fixed cyan cursor provides consistent visibility.

**Alternatives considered:**
- Auto-detect text color and choose a contrasting cursor color — adds complexity, fragile.
- Make cursor color configurable per-message — overkill for a CLI.

### 2. Auto-scroll via useEffect with ref
**Decision:** Replace the render-phase hash check + `scrollToBottom()` with a `useEffect` that watches `messages.length` and `scrollRef.current`.

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
**Decision:** Use `useRef` to cache the parsed markdown result keyed by content.

**Rationale:** `marked.parse()` is synchronous but non-trivial for long messages. Caching avoids unnecessary work on re-renders.

**Alternatives considered:**
- Use `useMemo` — not guaranteed to persist in all React modes. `useRef` is more reliable.
- Cache at module level — shared across instances, risky if content differs.

### 5. Guard scroll methods with interactive check
**Decision:** Check `stdout.isTTY && !process.env.CI` before calling scroll methods, plus null ref check.

**Rationale:** Ink's interactive mode detection uses both `isTTY` and CI detection. Guarding on both prevents errors in CI/piped environments.

**Alternatives considered:**
- Try/catch around scroll calls — masks real errors.
- Check only `process.env.CI` — doesn't cover non-TTY scenarios.

### 6. Strip streaming cursor before markdown parse
**Decision:** Before passing content to `marked.parse()`, strip the streaming cursor character (`\u2588`) from the end of the content string.

**Rationale:** `marked.parse()` will attempt to parse the cursor character as markdown, potentially producing unexpected ANSI output. Stripping it before parsing ensures clean output while keeping the cursor visible in the UI.

**Alternatives considered:**
- Pass cursor character through parser and filter it out afterward — more complex, risk of parser errors.
- Don't parse markdown during streaming — loses formatting for streamed content.

### 7. MessageBubble memo uses stable identifier
**Decision:** Replace `_index` in `MessageBubble.areEqual` with a content-based hash (e.g., `role + content + time`) as the stable identifier for memo comparison.

**Rationale:** Array indices shift when messages are filtered (error case), causing the memo to incorrectly skip re-renders. A content-based hash is stable across message reordering and filtering.

**Alternatives considered:**
- Add a `messageId` to each message object — requires changes to message creation, more invasive.
- Use `content` directly as the key — could cause collisions if two messages have identical content.

### 8. Scroll API verified against ink-scroll-view
**Decision:** Before calling any scroll method, verify the ref is non-null AND that the method exists on the ref object. Log a warning if a method is missing.

**Rationale:** The spec requires using verified `ink-scroll-view` API methods. Defensive checks prevent runtime errors if the package API changes or if a different scroll implementation is used.

**Alternatives considered:**
- Trust the ref type — no runtime checks, but silent failures if API changes.
- Try/catch around all scroll calls — masks real errors, harder to debug.

## Risks / Trade-offs

**Risk:** Changing cursor color from white to cyan may look inconsistent with the user's custom color scheme.
**Mitigation:** The cursor was invisible before. Cyan is a standard terminal cursor color and will be visible against any background.

**Risk:** Removing `wrap: "hard"` could cause very long unbroken strings (e.g., URLs) to overflow the terminal width.
**Mitigation:** `marked-terminal` already handles this via its own wrapping logic. If needed, `overflowX: "hidden"` can be added to the parent Box as a separate concern.

**Risk:** Moving auto-scroll to `useEffect` changes timing — scroll happens after render instead of during.
**Mitigation:** The visual difference is imperceptible. The scroll will happen on the next paint, which is the correct React pattern.

**Risk:** `marked-terminal` produces ANSI escape codes that may cause layout misalignment in Ink's Yoga engine (which calculates by char count, not visual width).
**Mitigation:** This is a known limitation of the `marked-terminal` + Ink integration. Acceptable for current use case; can be addressed with a custom renderer if needed.

## Migration Plan

This is a pure code fix with no API changes, no config changes, and no data migration. The changes are:
1. Delete dead code from `inputPanel.js` and `conversationPanel.js`
2. Update `Blink` component to use fixed cyan cursor
3. Move auto-scroll logic to `useEffect` in `ConversationPanel`
4. Remove `wrap: "hard"` from `MarkdownText`
5. Add parse caching to `MarkdownText`
6. Add `isTTY && !CI` guard to scroll calls in `ConversationPanel`
7. Fix `dim` to `dimColor` in `MessageBubble`
8. Strip streaming cursor character before markdown parse
9. Replace `_index` with content hash in `MessageBubble.areEqual`
10. Add stable `key` prop to `InputPanel` in `app.js`
11. Add null/method-existence checks before scroll API calls

No rollback needed — if issues arise, revert the commit.

## Open Questions

- None. All 12 audit findings have clear remediation paths.
