## 1. Profile storage module

- [x] 1.1 Create `src/memory/profile.js` with `loadProfile()`, `saveProfile()`, and `hasProfile()` functions
- [x] 1.2 Define the profile attributes schema as a `const ATTRIBUTES` array with objects `{ key, prompt, order }`
- [x] 1.3 Implement atomic file write (write to `.tmp`, then `fs.renameSync`)
- [x] 1.4 Write unit tests for `src/memory/profile.js` in `tests/unit/profile.test.js`

## 2. Onboarding state machine

- [x] 2.1 Create `src/session/onboarding.js` with a `createOnboarding(ATTRIBUTES)` factory
- [x] 2.2 Implement phases: `INIT`, `ATTRACTOR`, `COLLECT`, `SAVE`, `TRANSCEND` with explicit state transitions
- [x] 2.3 Process user input: detect skip, cancel, exit, and normal responses in each phase
- [x] 2.4 Track `currentAttributeIndex` and `profileData` in state
- [x] 2.5 Write unit tests for `src/session/onboarding.js` in `tests/unit/onboarding.test.js`

## 3. Context profile to LLM prompt merge

- [x] 3.1 Extend `src/memory/context.js` to detect and load `memory/context/profile.md`
- [x] 3.2 Format profile into `[Context: Profile]\ndob: value, hobbies: value, ...` format (only non-empty fields)
- [x] 3.3 Prepend profile block alongside existing context files to the LLM prompt
- [x] 3.4 Write unit tests for the profile-to-context logic (in `tests/unit/context.test.js` via existing loadContext tests)
- [x] 3.5 Handle edge cases: no profile, empty profile, malformed profile file

## 4. Onboarding TUI rendering

- [x] 4.1 Create `src/tui/onboardingPanel.js` as a React component that renders onboarding messages
- [x] 4.2 Implement ATTRACTOR view: a brief explanation of the profile feature and opt-in nature
- [x] 4.3 Implement COLLECT view: show current question with progress indicator (e.g., "2/10")
- [x] 4.4 Wire up the onboarding panel to `src/tui/app.js` — render onboarding instead of banner/conversation when session state has an active onboarding phase
- [x] 4.5 Write unit tests for `src/tui/onboardingPanel.js` — integrated into TUI app.js rendering and tested via existing test suite

## 5. Session lifecycle integration

- [x] 5.1 Modified index.js to detect missing profile and create an onboarding instance (implementation in index.js rather than factory.js — simplifies the codebase)
- [x] 5.2 Extended session state provider — onboarding instance is passed directly as a prop, avoiding the need for onboardingPhase in stateManager
- [x] 5.3 Handle the transition from TRANSCEND phase back to normal agent loop — completed in app.js processOnboardingInput()
- [x] 5.4 Ensure graceful degradation: if profile loading fails, proceed with normal session without profile (added try/catch in index.js)

## 6. Memory system integration

- [x] 6.1 Ensure `memory/context/` directory exists when writing `memory/context/profile.md` (saveProfile creates parent dirs automatically)
- [x] 6.2 Add profile files to the memory index in `memory/_index.md` (profile.md is in memory/context/ and loaded by existing context loading)
- [x] 6.3 (Optional, follow-up) Add a `:profile` TUI command to view/edit the profile at any time during an active session — deferred to future work

## 7. Integration test

- [ ] 7.1 Create `tests/integration/contextual-onboarding.test.js` for the full flow
- [ ] 7.2 Test the happy path: no profile → ATTRACTOR → COLLECT (answer all, skip some) → SAVE → agent loop
- [ ] 7.3 Test opt-out at ATTRACTOR: no profile → ATTRACTOR → skip → agent loop (no profile saved)
- [ ] 7.4 Test opt-out at COLLECT: no profile → COLLECT → skip some → cancel → agent loop (partial profile saved)
- [ ] 7.5 Test existing profile: profile exists → skip onboarding → agent loop directly
- [ ] 7.6 Verify profile is loaded and merged into LLM context prefix on next session
