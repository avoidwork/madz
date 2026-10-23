## Context

The `FilePicker` component in `src/tui/filePicker.js` renders a column `Box` containing the input `Text` and, below it, either a "Loading files..." message, a "No matching files." empty message, or the matched-file list. When the `@` autocomplete filter matches no files, the "No matching files." message is rendered as a sibling of the input line, obscuring what the user typed.

This is a small, single-component change. It does not touch multiple subsystems, introduce dependencies, or require a migration. A design document is included for completeness because the change alters the rendered output contract of a TUI component.

## Goals / Non-Goals

**Goals:**
- Remove the "No matching files." empty message from the `FilePicker` render.
- Render nothing (an empty list) when the filter matches no files, so the typed input is never obscured.
- Preserve the existing "Loading files..." state and the matched-file list rendering.
- Add a unit test verifying no empty message is rendered when the filter has no matches.

**Non-Goals:**
- Do NOT reposition the empty message below the input line (the previously reverted approach in PR #1413 / commit 7efa4422).
- Do NOT add a new empty-state placeholder or message.
- Do NOT change the "Loading files..." behavior.

## Decisions

- **Remove the empty-message ternary branch entirely.** The render currently uses a nested ternary: `!loaded ? "Loading files..." : filteredFiles.length === 0 ? " No matching files." : visibleFiles.map(...)`. The fix removes the `filteredFiles.length === 0` branch so that when `loaded` is true and no files match, the render produces an empty list (no children). This is the simplest change that satisfies the requirement and avoids reintroducing any placeholder text.
- **Keep the "Loading files..." branch.** The `!loaded` state is a distinct loading state and is not part of this bug. It is preserved unchanged.
- **Test via `renderToString`.** The project's TUI tests use ink's `renderToString` (synchronous, no terminal). The `FilePicker` uses `useInput` (which returns no-op defaults under `renderToString`) and a debounced glob effect. To test the "no matches" render deterministically, the test will mock `fast-glob` to return a fixed file list and use `mock.timers` to advance the debounce, then assert the rendered output does not contain "No matching files.".

## Risks / Trade-offs

- [The debounced glob effect means the initial render shows "Loading files..."] → Mitigation: the test advances the debounce timer and awaits the effect so the loaded state is reached before asserting.
- [Mocking `fast-glob` via `mock.module` requires the experimental module-mocks flag] → Mitigation: the test uses `node:test`'s `mock.module` with the `--experimental-test-module-mocks` flag, consistent with the project's Node 24+ runtime. If the flag is unavailable, fall back to asserting the render contract via a direct component render with a pre-populated cache.
