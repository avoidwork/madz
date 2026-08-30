## Context

The messageBubble component in `src/tui/messageBubble.js` displays a static " thinking" text beside a Spinner during AI processing (line 278). This text is hardcoded and provides no visual variety to users during potentially long processing times.

## Goals / Non-Goals

**Goals:**
- Replace the hardcoded " thinking" string with a randomly selected word from a curated list
- Add a THINKING_WORDS constant array with 25 curated words
- Add a getRandomThinkingWord() helper function
- Ensure the word changes on each render for visual variety

**Non-Goals:**
- No configuration options for the word list
- No persistence of word selections
- No changes to the Spinner component itself
- No changes to other UI components

## Decisions

### Decision 1: Module-level constant array
**Choice:** Define THINKING_WORDS as a module-level constant in messageBubble.js
**Rationale:** The word list is static and only used by this component. A module-level constant is simpler than creating a separate module or adding configuration. This follows the existing pattern in the codebase where component-specific constants are defined at the top of the file.

### Decision 2: Math.random() for selection
**Choice:** Use Math.random() for uniform random selection
**Rationale:** No cryptographic security is needed. Math.random() is simple, fast, and provides sufficient randomness for UI purposes. No external dependencies required.

### Decision 3: Inline function call in JSX
**Choice:** Call getRandomThinkingWord() directly in the JSX render
**Rationale:** Since the word should change on each render, calling the function inline ensures the latest random value is used. No state management or useEffect needed. This is a simple, declarative approach that leverages React's render cycle.

### Decision 4: No state for word tracking
**Choice:** Don't track previously shown words or prevent repeats
**Rationale:** With 25 words and typical processing times, the probability of seeing the same word twice in a row is low (4%). Adding state to track and avoid repeats would add complexity without meaningful UX benefit.

## Risks / Trade-offs

### Risk: Same word appears on consecutive renders
**Mitigation:** With 25 words, the probability is only 4% for any given re-render. This is acceptable for a cosmetic feature.

### Risk: Word list may feel stale over time
**Mitigation:** The word list can be easily updated in a future change by modifying the THINKING_WORDS array. No code changes required.

### Risk: Line length exceeds 100 characters
**Mitigation:** The word list is defined across multiple lines to stay within the 100-character limit. The inline function call in JSX is kept concise.

## Migration Plan

This is a simple code change with no migration required:
1. Add THINKING_WORDS constant to messageBubble.js
2. Add getRandomThinkingWord() helper function
3. Replace hardcoded " thinking" with getRandomThinkingWord() in JSX
4. Test that the app renders correctly

## Open Questions

None — the implementation approach is clear and well-defined by the specs.
