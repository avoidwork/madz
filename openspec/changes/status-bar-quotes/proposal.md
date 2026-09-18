## Why

The status bar currently shows only status indicators and the version number. Adding a rotating quote injects personality into the TUI, consistent with madz's persona-driven design. The quote changes at a fixed interval (~2 minutes), chosen at random, and never repeats the immediately-previous quote.

## What Changes

- Add a rotating quote to the bottom status bar, displayed to the left of the version number on the right side.
- Introduce a new `src/tui/quotes.js` module holding a frozen `QUOTES` array of 25 curated real Mads Mikkelsen interview quotes, plus a `getRandomQuoteIndex(previousIndex, random)` helper that avoids repeating the last-shown quote.
- Modify `src/tui/statusBar.js` to accept a `quote` prop and render it to the left of the version, styled subtly and truncated to fit terminal width.
- Modify `src/tui/inputArea.js` to own a quote rotation interval (~2 minutes) that only ticks while the status bar is visible (normal mode, not during banner/onboarding).
- Extend `tests/unit/tui/statusBar.test.js` with tests for the quote helper and StatusBar quote rendering.
- Design the data structure so a second list of character quotes can be merged in later (additive merge, no rewrite of rotation logic).

## Capabilities

### New Capabilities
- `status-bar-quotes`: Rotating quote display in the TUI status bar, with a finite curated quote list, random rotation avoiding immediate repeats, and a mergeable data structure for future character quotes.

### Modified Capabilities
<!-- No existing specs are changing — this is a new status bar capability, not a change to existing TUI interface requirements. -->

## Impact

- **`src/tui/quotes.js`** (new): frozen `QUOTES` array + `getRandomQuoteIndex` helper.
- **`src/tui/statusBar.js`**: accept and render `quote` prop to the left of the version.
- **`src/tui/inputArea.js`**: own the quote rotation interval, only ticking while the status bar is visible.
- **`tests/unit/tui/statusBar.test.js`**: new tests for the helper and StatusBar rendering.
- **No behavioral change** to the left-side status indicators, InputPanel, or banner/onboarding rendering.
