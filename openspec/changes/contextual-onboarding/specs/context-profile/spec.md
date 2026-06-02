## ADDED Requirements

### Requirement: Profile Attributes Schema
The system SHALL define a context profile schema with the following optional attributes: `dob` (date of birth), `relationship` (relationship status), `pets` (string describing pets), `hobbies` (comma-separated list), `expertise` (comma-separated list of domains of expertise), `favoriteBands` (comma-separated list of favorite bands), `favoriteBooks` (comma-separated list of favorite books), `favoriteTv` (comma-separated list of favorite TV shows), `favoriteMovies` (comma-separated list of favorite movies), and `notes` (free-form string). Each attribute is a single-string field; no validation beyond non-null is required.

#### Scenario: Profile schema defines all optional attributes
- **WHEN** the system needs to validate a profile structure
- **THEN** the profile is accepted if it contains any subset of the defined attributes with string values

#### Scenario: Profile with empty string values is valid
- **WHEN** a user provides an empty string for an attribute
- **THEN** the system records the attribute with that empty value

### Requirement: Conversational Onboarding Flow
When the system detects that no context profile exists for the current user, it SHALL present an onboarding flow consisting of three phases: ATTRACTOR (explaining the purpose and opt-in nature), COLLECT (asking about individual attributes one at a time in a round-robin order over the attribute list), and SAVE (persisting the collected data before transitioning to the agent).

#### Scenario: System detects missing profile and starts onboarding
- **WHEN** the user launches the application for the first time or after deleting their profile
- **THEN** the system enters the ATTRACTOR phase and explains that it can learn about the user to provide a better experience

#### Scenario: User opts in and begins attribute collection
- **WHEN** the user responds positively to the ATTRACTOR message (e.g., starts typing or sends a message)
- **THEN** the system begins the COLLECT phase, starting with the first attribute in the list

#### Scenario: User opts out at ATTRACTOR phase
- **WHEN** the user types "skip", "skip onboarding", or "cancel" during the ATTRACTOR phase
- **THEN** the system exits the ATTRACTOR phase — if the user typed "cancel", the application exits entirely; if "skip", the system proceeds directly to the agent loop with no profile data

#### Scenario: User answers a COLLECT question
- **WHEN** the system prompts for a specific attribute and the user provides a response
- **THEN** the system records the user's response for that attribute and proceeds to the next attribute in the list

#### Scenario: User skips a COLLECT question
- **WHEN** the user types "skip", "none", or "n/a" in response to an attribute prompt
- **THEN** the system omits that attribute from the profile and proceeds to the next attribute

#### Scenario: User cancels during COLLECT phase
- **WHEN** the user types "cancel", "stop", or "exit" during the COLLECT phase
- **THEN** the system saves any attributes collected so far, writes the partial profile to disk, and transitions to the agent loop

#### Scenario: System saves profile on flow completion
- **WHEN** the system has processed all attributes in the COLLECT phase
- **THEN** the system writes the complete profile to `memory/context/profile.md` and transitions to the agent loop

### Requirement: Opt-In Controls at Every Step
The system MUST make three controls available at every step of the onboarding flow: skip (bypass the current question), cancel (end onboarding with partial data), and exit (terminate the application, only during ATTRACTOR). The system MUST NOT treat a non-empty user response as an attempt to exit.

#### Scenario: Exit is only available during ATTRACTOR phase
- **WHEN** the user is in the ATTRACTOR phase and types "exit"
- **THEN** the application terminates immediately

- **WHEN** the user is in the COLLECT phase and types "exit"
- **THEN** the system treats "exit" as a cancel (ending onboarding, staying in the application)

#### Scenario: Skip bypasses the current question
- **WHEN** the user types "skip" during COLLECT
- **THEN** the system does not record a value for the current attribute and proceeds to the next one

#### Scenario: Cancel during COLLECT saves partial data
- **WHEN** the user has answered 3 of 10 attribute questions and then types "cancel"
- **THEN** the system persists the 3 answered attributes to the profile file and transitions to the agent loop

### Requirement: Onboarding State Machine
The onboarding flow SHALL be managed by a state machine with the following phases and transitions:
- `INIT`: No profile exists; onboarding is eligible.
- `ATTRACTOR`: Present the onboarding intro. Transitions: `skip → SAVE`, `exit → exit application`, `proceed (user starts typing) → COLLECT`.
- `COLLECT`: Ask attributes sequentially. State includes `currentAttributeIndex` and `profileData`. Transitions: `skip/answer → next attribute`, `done (reached end of attributes) → SAVE`, `cancel → SAVE (with partial data)`.
- `SAVE`: Write profile to disk. Transitions: `done → TRANSCEND`.
- `TRANSCEND`: Onboarding complete; control returns to the agent loop.

#### Scenario: State machine advances past ATTRACTOR
- **WHEN** the user is in ATTRACTOR and types any non-control message (e.g., "yes", "how does this work?")
- **THEN** the system transitions to COLLECT phase

- **WHEN** the user types a normal message (not "skip", "cancel", or "exit")
- **THEN** the system treats it as proceeding into onboarding (from ATTRACTOR) or as an answer to the current attribute

#### Scenario: State machine transitions through COLLECT sequentially
- **WHEN** onboarding is in COLLECT phase with `currentAttributeIndex = 2` and 10 total attributes
- **THEN** the system prompts for the third attribute (index 2, 0-based)
- **THEN** after a response, the system advances `currentAttributeIndex` by 1

#### Scenario: State machine detects end of attributes
- **WHEN** `currentAttributeIndex >= totalAttributes` during COLLECT
- **THEN** the system transitions to SAVE

### Requirement: Profile to LLM Context Merge
The system SHALL load the user's context profile and format it as a structured context block that is prepended to the LLM prompt prefix, merged with any existing user context notes from `memory/context/`. The format SHALL be `[Context: Profile]\n<brief summary of attributes>` where the summary includes only non-empty attributes joined as `key: value` pairs.

#### Scenario: Profile with all fields fills context prefix
- **WHEN** the profile has dob, hobbies, relationship, pets, favoriteBands, and favoriteMovies set
- **THEN** the context prefix includes `[Context: Profile]\ndob: 1990, hobbies: hiking/reading, relationship: single, pets: cat named Luna, favoriteBands: Radiohead/Nirvana, favoriteMovies: Inception/Memento`

#### Scenario: Profile with partial fields fills context prefix
- **WHEN** the profile has only hobbies set
- **THEN** the context prefix includes `[Context: Profile]\nhobbies: hiking/reading`

#### Scenario: No profile or empty profile adds no context block
- **WHEN** `memory/context/profile.md` does not exist or is empty
- **THEN** the system does not add a `[Context: Profile]` block to the LLM prompt

### Requirement: Profile Persistence
The system SHALL persist the context profile as a markdown file at `memory/context/profile.md` using YAML frontmatter for structured fields and the markdown body for free-form notes. The file SHALL be written atomically (write to temp file, then rename) to prevent corruption.

#### Scenario: New profile is written on disk
- **WHEN** onboarding completes with collected data
- **THEN** `memory/context/profile.md` is created with YAML frontmatter containing the profile attributes and a timestamp

#### Scenario: Existing profile is overwritten on update
- **WHEN** the user runs onboarding again or edits their profile
- **THEN** the existing `memory/context/profile.md` is replaced with the updated data
