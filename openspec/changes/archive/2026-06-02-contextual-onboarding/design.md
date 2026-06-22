## Context

When a user launches the TUI, the application initializes a session and immediately enters the conversational agent loop. No user context exists at this point beyond raw `config.yaml`. The memory system already supports user-provided context notes via `memory/context/`, but there is no structured, personalized profile that the system uses from session start. This gap means every conversation begins with the same generic awareness, requiring users to re-share their background repeatedly.

## Goals / Non-Goals

**Goals:**
- Provide a conversational, multi-turn onboarding flow that collects a user's context profile (DOB, hobbies, relationship status, pets, domain expertise, communication preferences)
- Persist the profile to `memory/profile/` for cross-session retention
- Merge profile data into the LLM prompt prefix alongside existing context files
- Make the entire flow opt-in with skip/cancel/exit available at every step
- Transition seamlessly to the normal agent loop regardless of onboarding outcome

**Non-Goals:**
- Advanced ML-based profile inference from conversation history
- Profile import/export from external sources
- Visual profile editing UI (profile editing is done through conversation or TUI commands)
- Multi-user profile support

## Decisions

1. **State machine for onboarding flow (enum-based, not a LangGraph state machine)**
   - Rationale: Onboarding is a simple linear/branching flow, not a graph computation. A lightweight enum-based phase tracker in a new `src/session/onboarding.js` module is sufficient and avoids unnecessary complexity.
   - Phases: `INIT → ATTRACTOR → COLLECT → SAVE → TRANSCEND`
   - `ATTRACTOR`: Explain what the system can learn and why it helps. User responds with skip/cancel/proceed.
   - `COLLECT`: Iterate through profile attributes using a round-robin over the attributes list. Each attribute is a prompt. User can answer, skip, or cancel.
   - `SAVE`: Write profile to `memory/profile/profile.md` if any data was collected.

2. **Onboarding as a session lifecycle hook, not a TUI component**
   - The session factory (`src/session/factory.js`) detects whether a profile exists. If not, it returns an onboarding state that the TUI app detects and enters.
   - Rationale: Onboarding is a session-level decision (should this session start with onboarding?), not a display-level concern. The TUI app simply renders either the banner or the onboarding view based on session state.

3. **Profile storage as a Markdown file with YAML frontmatter in `memory/profile/`**
   - Format follows the same convention as other memory files (`memory/context/`, `memory/`).
   - Frontmatter contains structured fields (dob, hobbies, relationship, pets, expertise, style). Body contains any free-form notes.
   - Rationale: Consistency with existing memory system. No new database or file format needed.

4. **Profile data merged into LLM context during session start**
   - `src/memory/context.js` loads profile data alongside context files and prepends them to the LLM prompt prefix.
   - Format: `[Context: Profile]\n<profile summary>` so it integrates naturally with existing context.
   - Rationale: Reuses existing context loading mechanism. Simple and testable.

5. **Skip/cancel/exit as first-class transitions, not afterthoughts**
   - Skip: Bypasses current attribute prompt, moves to next attribute.
   - Cancel: Ends the onboarding flow but does not exit the application. Transitions to agent loop with whatever data was collected so far.
   - Exit: Only available in ATTRACTOR phase; terminates the entire application.
   - The system tracks whether onboarding was completed, skipped, or cancelled, and uses this to determine whether to prompt again on future sessions.

## Risks / Trade-offs

1. **Risk**: Onboarding adds latency on first launch. Users must go through a conversational flow before getting to the agent.
   **Mitigation**: Flow is short (~30 seconds). ATTRACTOR message is concise. Skip and progress quickly past questions. Future sessions skip entirely.

2. **Risk**: Users may provide inconsistent or overly detailed profile data.
   **Mitigation**: No validation beyond basic string sanitization. The LLM handles noisy data naturally. If needed, profile editing via `:profile` command in future iterations.

3. **Risk**: Profile could become outdated as users' circumstances change.
   **Mitigation**: A future `:profile` command allows editing. For now, the profile is treated as best-effort and the system can always use its conversational memory for updates.

4. **Risk**: Profile data in LLM prompts increases context window usage.
   **Mitigation**: Profile summary is bounded (fixed set of fields). If profile exceeds a reasonable size (e.g., 500 chars), truncate to the most recent/important fields.
