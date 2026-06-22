## ADDED Requirements

### Requirement: Sliding Window Repetition Detection
The system SHALL track sentence frequency within a time-based sliding window and detect when the same sentence appears more than 3 times.

#### Scenario: Frequency tracking within window
- **WHEN** sentences are added to the sliding window
- **THEN** the system tracks the frequency of each sentence within the window

#### Scenario: Repetition threshold trigger
- **WHEN** a sentence's frequency count reaches 3 within the sliding window
- **THEN** the system triggers loop detection and emits a loop detection event

#### Scenario: Frequency reset on expiration
- **WHEN** a sentence expires from the sliding window
- **THEN** the system decrements the frequency count for that sentence

### Requirement: Configurable Detection Parameters
The system SHALL use configurable parameters for loop detection sensitivity.

#### Scenario: Default threshold
- **WHEN** the system initializes without explicit configuration
- **THEN** the repetition threshold defaults to 3 and the window size defaults to 30 seconds

#### Scenario: Configurable threshold
- **WHEN** the system is configured with a custom repetition threshold
- **THEN** the system uses the custom threshold for loop detection