## ADDED Requirements

### Requirement: Sentence Boundary Detection
The system SHALL extract complete sentences from streaming text chunks by detecting sentence boundaries on `.`, `!`, or `?`.

#### Scenario: Sentence extraction on period
- **WHEN** a streaming chunk contains text ending with a period (e.g., "Let me check the status.")
- **THEN** the system emits the complete sentence "Let me check the status." to the sliding window tracker

#### Scenario: Sentence extraction on exclamation
- **WHEN** a streaming chunk contains text ending with an exclamation mark (e.g., "Done!")
- **THEN** the system emits the complete sentence "Done!" to the sliding window tracker

#### Scenario: Sentence extraction on question mark
- **WHEN** a streaming chunk contains text ending with a question mark (e.g., "Is this correct?")
- **THEN** the system emits the complete sentence "Is this correct?" to the sliding window tracker

#### Scenario: Partial sentence buffering
- **WHEN** a streaming chunk contains text that does not end with a sentence boundary (e.g., "Let me check")
- **THEN** the system buffers the partial text and waits for the next chunk to complete the sentence

#### Scenario: Ellipsis handling
- **WHEN** a streaming chunk contains consecutive periods (e.g., "...")
- **THEN** the system does not emit a sentence and continues buffering

#### Scenario: Multiple sentences in one chunk
- **WHEN** a streaming chunk contains multiple complete sentences (e.g., "Let me check. Done.")
- **THEN** the system emits each sentence separately ("Let me check." and "Done.")

### Requirement: Sliding Window Sentence Tracking
The system SHALL maintain a sliding window of recent sentences (~30 seconds) and track their frequency.

#### Scenario: Sentence added to window
- **WHEN** a complete sentence is emitted from the sentence detector
- **THEN** the system adds the sentence to the sliding window with a timestamp

#### Scenario: Sentence frequency tracking
- **WHEN** a sentence is added to the sliding window
- **THEN** the system increments the frequency count for that sentence in the window

#### Scenario: Old sentence expiration
- **WHEN** a sentence in the sliding window exceeds the 30-second time limit
- **THEN** the system removes the sentence from the window and decrements its frequency count

#### Scenario: Window memory management
- **WHEN** sentences expire from the sliding window
- **THEN** the system ensures no memory leaks or unbounded growth of the window data structure

### Requirement: Loop Detection
The system SHALL detect when the same sentence appears more than 3 times within the sliding window.

#### Scenario: Loop detection trigger
- **WHEN** the same sentence appears 3 or more times in the sliding window
- **THEN** the system emits a loop detection event (`{ type: 'loop_detected' }`)

#### Scenario: No false positive on two repetitions
- **WHEN** the same sentence appears exactly 2 times in the sliding window
- **THEN** the system does not emit a loop detection event

#### Scenario: No false positive on different sentences
- **WHEN** multiple different sentences appear in the sliding window but no single sentence repeats 3+ times
- **THEN** the system does not emit a loop detection event

### Requirement: Silent Nudge Emission
The system SHALL emit a silent "You're looping." nudge message when a loop is detected, following the existing nudge injection pattern.

#### Scenario: Nudge emission on loop detection
- **WHEN** a loop detection event is emitted
- **THEN** the system injects a silent "You're looping." nudge message into the TUI message stream

#### Scenario: Nudge non-disruption
- **WHEN** the "You're looping." nudge is injected
- **THEN** the nudge is non-disruptive to the user experience (silent, similar to "Please continue." nudge)

#### Scenario: Agent nudge handling
- **WHEN** the agent receives the "You're looping." nudge
- **THEN** the agent treats it as a signal to self-correct and re-evaluate its approach, not as a regular user message