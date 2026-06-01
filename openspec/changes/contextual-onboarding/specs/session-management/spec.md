## MODIFIED Requirements

### Requirement: Per-Session State Tracking
The system SHALL create a unique session identifier for each TUI invocation and track session-scoped state including the active LLM provider, conversation window size, current skill context, and contextual onboarding state (`onboardingPhase`: one of `INIT`, `ATTRACTOR`, `COLLECT`, `SAVE`, `TRANSCEND`, or `COMPLETE`).

#### Scenario: Each TUI session gets a unique ID
- **WHEN** the harness starts and creates a session
- **THEN** the system generates a UUID for the session and uses it as the LangGraph `thread_id` for all agent invocations

#### Scenario: Active provider is tracked per session
- **WHEN** the user switches providers via `:provider set <name>`
- **THEN** the session state records the new provider and uses it for all subsequent LLM calls in that session

#### Scenario: Onboarding phase is tracked in session state
- **WHEN** the contextual onboarding flow is active
- **THEN** the session state records the current onboarding phase and profile data being collected

### Requirement: Session Memory Loading
On session creation, the system SHALL load the latest conversation file from `memory/` and reconstruct the visible conversation buffer to provide continuity across sessions, up to the context window limit. Additionally, if a context profile exists at `memory/profile/profile.md`, the system SHALL detect it and enter the onboarding flow immediately before the conversational agent begins.

#### Scenario: Session resumes from last conversation
- **WHEN** the harness starts and a previous conversation file exists in `memory/`
- **THEN** the system renders previous messages in the conversation panel up to the context window limit

#### Scenario: Session detects missing profile and triggers onboarding
- **WHEN** the harness starts, no conversation file exists, and no profile exists at `memory/profile/profile.md`
- **THEN** the system enters the ATTRACTOR phase of the contextual onboarding flow before presenting the conversational interface

#### Scenario: Session skips onboarding if profile exists
- **WHEN** the harness starts and a valid profile exists at `memory/profile/profile.md`
- **THEN** the system skips the onboarding flow and begins the agent loop directly
