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

### Requirement: Garbled Repetition Detection
The system SHALL flag a loop when a sentence has normalized token-overlap similarity at or above a configurable similarity threshold with another sentence appearing more than the configured threshold times within the sliding window, so that garbled repetition (repeated sentences with corrupted characters) is detected in addition to byte-identical repetition.

#### Scenario: Garbled repetition is flagged as a loop
- **WHEN** the stream contains the same paragraph repeated with corrupted characters on each pass, such that no two sentences are byte-identical but each shares high token overlap with the others
- **THEN** the loop detector flags the stream as looping

#### Scenario: Distinct sentences are not flagged
- **WHEN** the stream contains genuinely distinct sentences with low token overlap
- **THEN** the loop detector does not flag the stream as looping

#### Scenario: Similarity threshold is configurable
- **WHEN** the similarity threshold is configured to a value
- **THEN** the loop detector uses that value to decide whether two sentences are similar enough to count as a repeat

### Requirement: Subagent Reasoning Loop Detection
The system SHALL apply loop detection to subagent reasoning streams in addition to the main agent loop, so that a subagent repeating the same reasoning without making progress is detected and its stream abandoned. Subagent reasoning SHALL be keyed per subagent so concurrent subagents do not share detector state, and subagent loop detection SHALL be toggleable via configuration.

#### Scenario: Repeating subagent reasoning is flagged
- **WHEN** a subagent emits the same reasoning across consecutive turns without making progress
- **THEN** the loop detector flags the subagent reasoning stream as looping and the stream is abandoned

#### Scenario: Varied subagent reasoning is not flagged
- **WHEN** a subagent emits varied reasoning that makes progress
- **THEN** the loop detector does not flag the subagent reasoning stream

#### Scenario: Concurrent subagents are tracked independently
- **WHEN** multiple subagents stream reasoning concurrently
- **THEN** each subagent's reasoning is keyed separately so their detector states do not mix

#### Scenario: Subagent loop detection is configurable
- **WHEN** subagent loop detection is disabled via configuration
- **THEN** subagent reasoning is not fed to the loop detector

#### Scenario: Subagent turn lifecycle releases detector state
- **WHEN** a subagent reasoning turn ends
- **THEN** the subagent's detector state is released so it does not leak into the next turn

#### Scenario: Subagent loop surfaces through the loop-detected signal
- **WHEN** a subagent reasoning loop is detected
- **THEN** the loop-detected signal is returned so the orchestrator can nudge, escalate, or abort the subagent

### Requirement: Subagent Message Loop Detection
The system SHALL apply loop detection to subagent message streams in addition to subagent reasoning, so that a subagent repeating the same message text without making progress is detected and its stream abandoned. Subagent message text SHALL be keyed per subagent so concurrent subagents do not share detector state, and subagent message loop detection SHALL be gated by the same `loopDetection.subagent` toggle that gates subagent reasoning.

#### Scenario: Repeating subagent message text is flagged
- **WHEN** a subagent emits the same message text across consecutive turns without making progress
- **THEN** the loop detector flags the subagent message stream as looping and the stream is abandoned

#### Scenario: Varied subagent message text is not flagged
- **WHEN** a subagent emits varied message text that makes progress
- **THEN** the loop detector does not flag the subagent message stream

#### Scenario: Concurrent subagent message streams are tracked independently
- **WHEN** multiple subagents stream message text concurrently
- **THEN** each subagent's message text is keyed separately so their detector states do not mix

#### Scenario: Subagent message loop detection is configurable
- **WHEN** subagent loop detection is disabled via configuration
- **THEN** subagent message text is not fed to the loop detector

#### Scenario: Subagent message turn lifecycle releases detector state
- **WHEN** a subagent message turn ends
- **THEN** the subagent's detector state is released so it does not leak into the next turn

#### Scenario: Subagent message loop surfaces through the loop-detected signal
- **WHEN** a subagent message loop is detected
- **THEN** the loop-detected signal is returned so the orchestrator can nudge, escalate, or abort the subagent
