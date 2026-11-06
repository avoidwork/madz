# Tasks

## 1. Core Implementation

- [x] 1.1 Update `MessageBubble` in `src/tui/messageBubble.js` to accept a raw timestamp (Date or ISO8601 string) via the `time` prop and format it at render time using `formatTime()`. Guard against invalid/missing timestamps by falling back to `formatTime(new Date())`. Verify by inspecting the `ts` computation at line 393 and confirming it formats the raw timestamp rather than rendering it verbatim.
- [x] 1.2 Update the live path in `src/tui/conversationArea.js` (`getTimestamp()` and the `addMessage` calls that pass `time`) to pass a raw `Date` rather than a pre-formatted string. Verify by confirming `getTimestamp()` returns a `Date` and the `addMessage` calls pass a `Date` to the `time` option.
- [x] 1.3 Confirm the session-restore paths (mount effect and `loadConversation` in `src/tui/conversationArea.js`) pass `exchange.timestamp` (ISO8601 string) and that this now renders correctly via the bubble's formatting. Verify by tracing the `time: exchange.timestamp` calls and confirming they flow into the bubble's `time` prop.
- [x] 1.4 Check the SUBAGENTS panel path that renders `MessageBubble` without a `topic` and confirm it honors the new `time` contract (passes a raw timestamp or is unaffected). Verify by inspecting the `MessageBubble` usage in `src/tui/subagentsPanel.js` and confirming no pre-formatted string is passed as `time`.

## 2. Tests

- [x] 2.1 Add a unit test in `tests/unit/tui/` covering the bubble's timestamp rendering for both a raw `Date` and a raw ISO8601 string, asserting both render the same localized short-form time. Verify the test passes with `npm run test`.
- [x] 2.2 Add a unit test covering the invalid/missing timestamp fallback, asserting the bubble renders `formatTime(new Date())` when `time` is missing or unparseable. Verify the test passes with `npm run test`.

## 3. Verification

- [x] 3.1 Run `npm run lint` and confirm no lint errors.
- [x] 3.2 Run `npm run coverage` and confirm coverage is maintained and no regressions.
