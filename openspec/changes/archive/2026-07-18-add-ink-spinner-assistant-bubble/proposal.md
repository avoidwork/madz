## Why

When the assistant is processing a user request, the TUI provides no visual feedback that work is underway. The user sees an empty response bubble and has no indication that the system is actively generating a response. This creates uncertainty and a poor perceived responsiveness. An animated spinner inside the assistant response bubble provides immediate, clear confirmation that the system is actively processing — improving the user experience during the wait period.

## What Changes

- Add `ink-spinner` as a project dependency via `npm install ink-spinner`
- Modify `src/tui/messageBubble.js` to render an animated spinner inside the assistant response bubble when no content has been received yet
- Spinner displays with a "Thinking" label styled in cyan, consistent with the existing TUI theme
- Spinner automatically hides when the first streamed chunk arrives, on abort, or on interruption — driven by existing state transitions (no new state variables)

## Capabilities

### New Capabilities

- `assistant-spinner`: Animated spinner displayed in the assistant response bubble while waiting for the first streamed response. Spinner shows when `chunks.length === 0 && !content` and hides on first chunk, abort, or interruption.

### Modified Capabilities

- `component-message-bubbles`: The MessageBubble component now conditionally renders a spinner in the pending state. The visual behavior changes but the component's data contract (props, state shape, pub/sub integration) remains unchanged.

## Impact

- **Dependencies:** New dependency `ink-spinner`
- **Code:** `src/tui/messageBubble.js` — add spinner import and conditional rendering
- **No API changes:** Purely a visual addition; no changes to component props, state shape, or pub/sub contract
- **No test changes required:** Existing tests should continue to pass; spinner is a visual-only addition that does not affect component logic
