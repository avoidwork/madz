## Why

The assistant messageBubble currently displays a static " thinking" text beside the Spinner component during AI processing. This static text feels monotonous and misses an opportunity to create a more engaging, dynamic user experience. Users see the same word repeated across every interaction, which reduces the sense of active processing and personality.

## What Changes

- Replace the hardcoded " thinking" string in the assistant messageBubble with a rotating selection of words from a curated list of 25 action-oriented words
- Add a `THINKING_WORDS` constant array containing curated words at module scope
- Add a `getRandomThinkingWord()` helper function that returns a random word from the list
- The word changes on each render, providing visual variety during the thinking state

## Capabilities

### New Capabilities
- `thinking-words`: Dynamic word rotation for the assistant thinking state in the messageBubble UI

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing requirements -->

## Impact

- **Affected code:** `src/tui/messageBubble.js` — the messageBubble component that renders the assistant's thinking state
- **No new dependencies:** Implementation uses only built-in JavaScript (`Math.random()`)
- **No API changes:** This is a purely cosmetic UI change with no impact on data flow or external interfaces
- **No breaking changes:** The change is fully backward compatible

## Non-goals

- This does not change the spinner animation itself — only the text beside it
- This does not add any configuration options for the word list or rotation behavior
- This does not persist or cache word selections across renders
- This does not modify any other component or UI element
