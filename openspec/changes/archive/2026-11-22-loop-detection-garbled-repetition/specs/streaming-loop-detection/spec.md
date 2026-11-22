# Spec Delta

## ADDED Requirements

### Requirement: Garbled Repetition Detection

The system SHALL flag a loop when a sentence has normalized token-overlap similarity at or
above a configurable similarity threshold with another sentence appearing more than the
configured threshold times within the sliding window, so that garbled repetition (repeated
sentences with corrupted characters) is detected in addition to byte-identical repetition.

#### Scenario: Garbled repetition is flagged as a loop

- **WHEN** the stream contains the same paragraph repeated with corrupted characters on
  each pass, such that no two sentences are byte-identical but each shares high token
  overlap with the others
- **THEN** the loop detector flags the stream as looping

#### Scenario: Distinct sentences are not flagged

- **WHEN** the stream contains genuinely distinct sentences with low token overlap
- **THEN** the loop detector does not flag the stream as looping

#### Scenario: Similarity threshold is configurable

- **WHEN** the similarity threshold is configured to a value
- **THEN** the loop detector uses that value to decide whether two sentences are similar
  enough to count as a repeat
