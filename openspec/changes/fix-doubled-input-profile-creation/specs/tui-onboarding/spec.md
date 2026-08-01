## MODIFIED Requirements

### Requirement: Onboarding input handling delegates to ink-text-input
The system SHALL delegate all character entry, cursor navigation, and backspace during profile creation to `ink-text-input` within `InputPanel`. The `useInput` hook SHALL only handle Enter (submit) and Escape (quit) during onboarding, and SHALL NOT manually append keystrokes to input state.

#### Scenario: Input appears once during profile creation
- **WHEN** the user types text in the input panel during profile creation
- **THEN** each character appears exactly once in the input panel

#### Scenario: Enter submits input during profile creation
- **WHEN** the user presses Enter in the input panel during profile creation
- **THEN** the input is submitted as a single message

#### Scenario: Escape quits during profile creation
- **WHEN** the user presses Escape in the input panel during profile creation
- **THEN** the onboarding flow is cancelled and the user quits

#### Scenario: No keystroke duplication
- **WHEN** the user types, backspaces, and navigates in the input panel during profile creation
- **THEN** no character is duplicated or echoed twice
