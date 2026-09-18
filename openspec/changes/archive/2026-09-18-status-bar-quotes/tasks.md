## 1. Quotes Module

- [x] 1.1 Create `src/tui/quotes.js` exporting a frozen `QUOTES` array containing the 25 curated real Mads Mikkelsen interview quotes
- [x] 1.2 Implement `getRandomQuoteIndex(previousIndex, random)` helper that returns a valid index, avoids the previous index when the list has more than one element, returns `0` for a single-element list, and returns `-1` for an empty list

## 2. StatusBar Rendering

- [x] 2.1 Modify `src/tui/statusBar.js` to accept a `quote` prop and render it to the left of the version number inside the right-side Box, styled with a muted color and truncated to fit terminal width

## 3. InputArea Rotation

- [x] 3.1 Modify `src/tui/inputArea.js` to own a quote rotation interval (~2 minutes) that only ticks while the status bar is visible (normal mode, not during banner/onboarding), updating the displayed quote via `getRandomQuoteIndex` and cleaning up the interval on unmount

## 4. Tests

- [x] 4.1 Extend `tests/unit/tui/statusBar.test.js` with tests for `getRandomQuoteIndex` (valid index, avoids previous index, single-element list, empty list) and that the StatusBar renders the quote
