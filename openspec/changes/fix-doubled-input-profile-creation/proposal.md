## Why

During profile creation in the TUI onboarding flow, user input text is duplicated in the input panel. Every keystroke appears twice, resulting in an invalid or malformed message being sent. This is caused by both the `useInput` hook and `ink-text-input` handling the same keystrokes simultaneously.

## What Changes

- Remove the manual character-appending block (`setInputText((prev) => prev + input)`) from the onboarding branch of the `useInput` hook in `src/tui/app.js`.
- The `useInput` hook during onboarding will only handle Enter (submit) and Escape (quit), delegating all typing to `ink-text-input` within `InputPanel`.

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, no new capabilities -->

### Modified Capabilities
- `tui-onboarding`: Fix input handling during profile creation to prevent keystroke duplication. The onboarding input flow should delegate all character entry to `ink-text-input` and only intercept Enter/Escape.

## Impact

- **Affected code**: `src/tui/app.js` — `useInput` hook (onboarding branch only, ~lines 809-819)
- **No changes** to `InputPanel`, `ink-text-input`, or any other TUI component.
- **No API changes**, no new dependencies, no spec-level behavioral changes beyond fixing the bug.
- **Non-goals**: Changes to input handling outside of onboarding, modifications to `ink-text-input`, or changes to other TUI panels.
