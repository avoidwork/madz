## Context

The madz TUI renders a bottom status bar (`src/tui/statusBar.js`) showing status indicators on the left (skills/messages/context counts) and the version number on the right, right-aligned via a `Box` with `marginLeft: "auto"`. The `StatusBar` is rendered by `InputArea` (`src/tui/inputArea.js`), which owns all status state and only renders the status bar in normal mode (not during banner/onboarding). The feature adds a rotating quote to the left of the version number.

## Goals / Non-Goals

**Goals:**
- Display a rotating quote in the status bar, to the left of the version number.
- Rotate the quote at a fixed ~2-minute interval, chosen at random, never repeating the immediately-previous quote.
- Ship with a finite v1 list of 25 curated real Mads Mikkelsen interview quotes.
- Design the data structure so a second list of character quotes can be merged in later (additive).
- Keep the quote subtle (muted color) and truncate long quotes to fit terminal width.

**Non-Goals:**
- No persistence of the current quote across sessions.
- No user-facing configuration of the rotation interval.
- No sourcing or adding character quotes in this change.
- No change to the left-side status indicators or the InputPanel.

## Decisions

### Decision 1: New `src/tui/quotes.js` module with frozen array + injectable-random helper
The module exports a frozen `QUOTES` array (the 25 curated real quotes) and a `getRandomQuoteIndex(previousIndex, random)` helper. The helper accepts an injectable `random` function (defaulting to `Math.random`) so it is deterministic and unit-testable without mocking `Math.random`. It returns a valid index in `[0, QUOTES.length)`, never returns `previousIndex` when the list has more than one element, returns `0` for a single-element list, and returns `-1` for an empty list.

**Alternative considered:** Inlining the quote list and rotation logic directly in `statusBar.js`. Rejected because it couples the data to the component and makes the mergeable character-quote structure harder to reason about. A dedicated module keeps the data and rotation logic isolated and testable.

### Decision 2: Rotation interval lives in `InputArea`, not `StatusBar`
`InputArea` owns status state and controls whether the `StatusBar` is rendered (only in normal mode). Placing the interval here means the timer only ticks while the status bar is visible, avoiding unnecessary work during banner/onboarding. The interval is ~2 minutes (120,000 ms). On each tick, the next index is computed via `getRandomQuoteIndex(previousIndex)` and the displayed quote is updated. The timer is cleaned up on unmount and when the status bar is not visible.

**Alternative considered:** A custom hook (`useQuoteRotation`) in `src/tui/hooks.js`. Rejected for now to keep the change minimal — the interval is small enough to live directly in `InputArea`. The hook can be extracted later if the rotation logic grows.

### Decision 3: Quote rendered to the left of the version, muted and truncated
The `StatusBar` accepts a `quote` prop. Inside the right-side `Box` (`marginLeft: "auto"`), the quote is rendered before the version so the right side reads `<quote>  <version>` with the version right-aligned. The quote uses the muted `#606060` color consistent with the existing status bar. Long quotes are truncated (capped at a reasonable character count) to avoid overflowing the terminal width.

### Decision 4: Mergeable data structure for future character quotes
The real quotes are stored as a frozen array. The `getRandomQuoteIndex` helper operates on the combined list. To merge character quotes later, a second array is added and concatenated into the source passed to the helper — no change to the rotation logic. This keeps the merge additive rather than a rewrite.

## Risks / Trade-offs

- **[Long quotes overflow the status bar]** → Truncate quotes to a fixed maximum character count before rendering.
- **[Timer leaks when status bar is hidden]** → Clean up the interval on unmount and when the status bar is not visible.
- **[Immediate repeat of the same quote]** → `getRandomQuoteIndex` explicitly avoids returning `previousIndex` when the list has more than one element.
- **[Single-element or empty list edge cases]** → Helper returns `0` for a single-element list and `-1` for an empty list, both handled gracefully by the caller.
