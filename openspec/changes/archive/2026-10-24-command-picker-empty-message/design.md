## Context

The command picker (`src/tui/commandPicker.js`) renders a gray `" No matching commands."` `Text` element as a sibling of the input `Text` whenever `filteredCommands.length === 0`. Both are children of a single column `Box`, so the message renders on the line directly below the input and obscures it when the user types a typo like `/confg`. The file picker had the identical defect and was fixed in commit a3d2833e (issue 1412) by rendering `null` in the equivalent branch.

## Goals / Non-Goals

**Goals:**
- Render `null` in the `CommandPicker` render branch when `filteredCommands.length === 0`, so nothing is rendered below the input line.
- Keep the typed input line always visible, even on a typo.
- Add render tests mirroring the file picker's, plus a `deriveCommandFilter` precondition test.

**Non-Goals:**
- No change to command filtering, navigation, selection, or trigger behavior.
- No change to `deriveCommandFilter`, `shouldOpenCommandPicker`, `replaceCommandToken`, or `MAX_VISIBLE`.
- No change to the file picker or other TUI panels.

## Decisions

- **Render `null` instead of the empty-message `Text`.** This mirrors the file picker's established fix exactly. The alternative — keeping the message but repositioning it — would still obscure the input and diverge from the file picker's behavior. Rendering `null` is the minimal, consistent fix.
- **Mirror the file picker render tests.** Use `renderToString` from `ink`, which is synchronous and does not run effects, so the component renders in its initial state. Pass a `commandList` that yields no matches for the filter (e.g. `commandList: ["config"]` with value `/confg`) so the empty branch is exercised.

## Risks / Trade-offs

- [The empty branch is only reachable when the filter is active but matches nothing] → The precondition test asserts `deriveCommandFilter("/confg", ...)` is still active, so the branch is genuinely exercised.
- [`renderToString` does not run effects, so `useInput` is not active] → This is safe; the render tests only assert on the rendered output, not on input handling.
