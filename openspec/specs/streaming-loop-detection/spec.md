# streaming-loop-detection Specification

## Purpose
TBD - created by archiving change streaming-loop-detection. Update Purpose after archive.
## Requirements
### Requirement: Sentence Boundary Detection
The system SHALL buffer incoming streaming text chunks and emit complete sentences when sentence boundary characters (`.`, `!`, `?`) are detected.

#### Scenario: Sentence emitted on period boundary
- **WHEN** a streaming chunk contains text ending with a period followed by whitespace or end-of-stream
- **THEN** the sentence detector emits the complete sentence including the period

#### Scenario: Sentence emitted on exclamation boundary
- **WHEN** a streaming chunk contains text ending with an exclamation mark followed by whitespace or end-of-stream
- **THEN** the sentence detector emits the complete sentence including the exclamation mark

#### Scenario: Sentence emitted on question boundary
- **WHEN** a streaming chunk contains text ending with a question mark followed by whitespace or end-of-stream
- **THEN** the sentence detector emits the complete sentence including the question mark

#### Scenario: Partial chunks are buffered
- **WHEN** a streaming chunk does not contain a complete sentence (no boundary character)
- **THEN** the sentence detector buffers the chunk and waits for the next chunk

#### Scenario: Multiple sentences in one chunk
- **WHEN** a streaming chunk contains multiple complete sentences
- **THEN** the sentence detector emits each sentence separately in order

### Requirement: Sliding Window Sentence Tracking
The system SHALL maintain a sliding window of recent sentences with timestamps, release sentences older than 30 seconds, and track sentence frequency within the window.

#### Scenario: Sentence added to window
- **WHEN** a complete sentence is emitted by the sentence detector
- **THEN** the sliding window tracker adds the sentence with a timestamp to the window

#### Scenario: Old sentences are released
- **WHEN** a sentence in the window is older than 30 seconds
- **THEN** the sliding window tracker removes the sentence from the window

#### Scenario: Sentence frequency is tracked
- **WHEN** a sentence is added to the window
- **THEN** the sliding window tracker increments the frequency count for that normalized sentence

#### Scenario: Sentence normalization is consistent
- **WHEN** two sentences differ only in whitespace or case
- **THEN** they are treated as the same sentence for frequency tracking

### Requirement: Loop Detection Threshold
The system SHALL detect a loop when any sentence appears more than 3 times within the sliding window.

#### Scenario: Loop detected at threshold
- **WHEN** a sentence appears 4 or more times within the 30-second sliding window
- **THEN** the system emits a `{ type: 'loop_detected' }` callback event

#### Scenario: No loop below threshold
- **WHEN** a sentence appears 3 or fewer times within the 30-second sliding window
- **THEN** the system does NOT emit a loop_detected event

#### Scenario: Different sentences do not trigger loop
- **WHEN** multiple different sentences each appear 2 times within the window
- **THEN** the system does NOT emit a loop_detected event (no single sentence exceeds threshold)

### Requirement: Silent Loop Nudge
The system SHALL inject a silent "You're looping." nudge into the streaming pipeline when a loop is detected, following the existing RECURSION_LIMIT_MESSAGE pattern.

#### Scenario: Nudge is emitted as special event
- **WHEN** a loop is detected (sentence appears >3 times in window)
- **THEN** the system emits a `{ type: 'loop_detected' }` event into the streaming callback pipeline

#### Scenario: Nudge is silent and non-disruptive
- **WHEN** a loop_detected event is received by the TUI
- **THEN** the nudge is displayed silently without interrupting the stream or confusing the user

#### Scenario: Nudge follows existing pattern
- **WHEN** the loop nudge is injected
- **THEN** it uses the same message handling pattern as RECURSION_LIMIT_MESSAGE in react.js

### Requirement: Per-Stream Sampler State
The system SHALL maintain sentence sampler state per-stream, resetting the sliding window and buffer when a stream ends or is aborted.

#### Scenario: Sampler resets on stream end
- **WHEN** a streaming response completes normally
- **THEN** the sentence detector clears its buffer and the sliding window tracker resets

#### Scenario: Sampler resets on stream abort
- **WHEN** a streaming response is aborted (e.g., user presses escape)
- **THEN** the sentence detector clears its buffer and the sliding window tracker resets

#### Scenario: Concurrent streams have independent samplers
- **WHEN** multiple streams are active simultaneously
- **THEN** each stream has its own independent sentence detector and sliding window tracker

### Requirement: Integration with Streaming Pipeline
The system SHALL integrate the sentence sampler into `callReactAgentStreaming()` in `src/agent/react.js`, hooking into the `on_chat_model_stream` event handler without modifying chunk data.

#### Scenario: Sampler intercepts chunks without modification
- **WHEN** text chunks arrive via on_chat_model_stream events
- **THEN** the sentence sampler receives the chunks for analysis but does not modify them before passing to the callback

#### Scenario: Sampler is positioned between chunk processing and callback
- **WHEN** a streaming event loop processes events
- **THEN** the sentence sampler sits between the raw chunk processing and the callback invocation

#### Scenario: Stream cleanup resets sampler
- **WHEN** the streaming loop exits (normal completion, error, or abort)
- **THEN** the sampler state is cleaned up and no memory leaks occur

