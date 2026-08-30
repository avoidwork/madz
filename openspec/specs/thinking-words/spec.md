# thinking-words Specification

## Purpose
TBD - created by archiving change randomized-thinking-words-spinner. Update Purpose after archive.
## Requirements
### Requirement: Thinking words are randomly selected from a curated list
The messageBubble component SHALL display a randomly selected word from a curated list of 25 action-oriented words instead of the hardcoded "thinking" text during the assistant's processing state.

#### Scenario: Word list contains 25 curated words
- **WHEN** the messageBubble component is initialized
- **THEN** a THINKING_WORDS constant array is available containing exactly 25 words: Brewing, Weaving, Distilling, Assembling, Curating, Simmering, Unspooling, Crafting, Kindling, Polishing, Orchestrating, Converging, Illuminating, Tuning, Sculpting, Harmonizing, Coalescing, Stirring, Unfolding, Refining, Pondering, Forging, Aligning, Resonating, Awakening

#### Scenario: Random word is selected on each render
- **WHEN** the messageBubble renders the thinking state
- **THEN** a word is randomly selected from THINKING_WORDS using a helper function and displayed beside the Spinner

#### Scenario: Word changes between renders
- **WHEN** the messageBubble re-renders while in the thinking state
- **THEN** a potentially different word may be displayed, providing visual variety to the user

### Requirement: Random word selection helper function
The module SHALL export a `getRandomThinkingWord()` function that returns a random word from the THINKING_WORDS array.

#### Scenario: Helper returns a valid word
- **WHEN** getRandomThinkingWord() is called
- **THEN** the function returns one of the 25 words from THINKING_WORDS

#### Scenario: Helper uses uniform random selection
- **WHEN** getRandomThinkingWord() is called multiple times
- **THEN** each call independently selects a word with equal probability from the list

