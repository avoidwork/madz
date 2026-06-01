## Why

Users launching the application frequently lack a foundational context profile. Without one, the system cannot deliver personalized, relevant, or proactive interactions from the first message. Users must repeatedly share their background, preferences, and constraints during every session, degrading the experience and reducing response quality.

## What Changes

- Introduce a conversational **contextual onboarding** flow triggered on first session or when context is missing
- The flow gathers structured user attributes (date of birth, relationship status, pets, hobbies, communication style preferences, domain expertise, and other lifestyle attributes) via a sequence of natural, low-friction prompts
- Every field is strictly opt-in; users may skip, cancel, or exit at any point without losing progress or breaking the flow
- Upon completion or user-initiated exit, control passes seamlessly to the core conversational agent
- Persist the collected profile in the memory system so subsequent sessions are immediately personalized
- Expose the profile to both the LLM context and the TUI so the assistant can tailor its behavior

## Capabilities

### New Capabilities

- `context-profile`: Captures, stores, and applies a user context profile through a conversational onboarding flow

### Modified Capabilities

- `session-management`: On first session start, intercepts normal session initialization to launch the contextual onboarding flow before the conversational agent begins
- `memory-system`: Adds a new memory category (`memory/profile/`) for the persistent context profile; context files from this profile are merged into the LLM prompt prefix alongside existing user context notes

## Impact

- `src/tui/app.js` — Add an onboarding phase that renders before the banner; the app transitions to normal flow once onboarding completes or the user exits
- `src/session/` — Modify `factory.js` or `loader.js` to detect missing context profile and trigger onboarding at session creation
- `src/memory/context.js` — Extend to include profile data in the context prefix loaded into LLM prompts
- `src/tui/hooks.js` or new module — State machine for the multi-turn onboarding conversation
- `src/memory/profile.js` or similar — New module for profile persistence and retrieval with `memory/profile/` directory
- `src/tui/panels.js` or new panel component — Onboarding panel for rendering onboarding messages in the TUI
- `tests/unit/` — New tests for onboarding state machine, profile storage/retrieval, and context merging
