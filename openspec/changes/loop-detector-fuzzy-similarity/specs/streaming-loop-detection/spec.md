# Spec Delta

## ADDED Requirements

### Requirement: Garbled Repetition Detection
The system SHALL detect a loop when a sentence repeats more than `threshold` times within the sentence window even when the repeated sentences are not byte-identical but are garbled variants of the same content, using normalized similarity matching with a configurable similarity threshold.

#### Scenario: Garbled repetition is flagged
- **WHEN** the same content is emitted repeatedly with corrupted characters introduced on each pass, so no two sentences are byte-identical but their normalized token overlap exceeds the similarity threshold
- **THEN** the system flags a loop and emits a `{ type: 'loop_detected' }` callback event

#### Scenario: Similarity threshold is configurable
- **WHEN** the loop detection configuration specifies a `similarityThreshold` value
- **THEN** the system uses that value to decide whether two sentences are similar enough to count as a repeat

#### Scenario: Distinct sentences are not false-flagged
- **WHEN** multiple distinct sentences with low token overlap appear within the sentence window
- **THEN** the system does NOT emit a loop_detected event

#### Scenario: Exact-match fast path is preserved
- **WHEN** a sentence repeats byte-identically more than `threshold` times within the sentence window
- **THEN** the system still flags a loop via the existing exact-match check
