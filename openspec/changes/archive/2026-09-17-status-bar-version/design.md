## Context

The TUI status bar (`src/tui/statusBar.js`) currently renders status indicator, skill count, message count, and context size on the left side of a `flexDirection: "row"` box with `justifyContent: "flex-start"`. The application version is only shown in the startup banner via the `Banner` component. The `appInfo` object (`{ name: config.tui.name, version: pkg.version }`) is already constructed in `index.js` (line 408) and passed to `App`, which threads it to `ConversationArea` and `Banner` but not to `InputArea`/`StatusBar`.

This change surfaces the version persistently in the status bar, right-aligned, by threading the existing `appInfo` down to `StatusBar`.

## Goals / Non-Goals

**Goals:**
- Display the application version right-aligned in the bottom status bar.
- Reuse the existing `appInfo` plumbing — no new dependencies or config.
- Keep the version element conditional so it renders nothing when no version is provided.
- Preserve existing behavior (status counts on the left, no version when absent).

**Non-Goals:**
- Not adding a `/version` slash command.
- Not changing the startup banner behavior.
- Not modifying `index.js` (the `appInfo` construction already exists).
- Not adding any new dependencies or configuration.

## Decisions

### Decision 1: Right-align via `marginLeft: "auto"` on a sibling `Box`
The parent `Box` uses `flexDirection: "row"` with `justifyContent: "flex-start"`. The idiomatic Ink approach to push a child to the far right is to add a sibling `Box` with `marginLeft: "auto"` after the existing left `Box`. This avoids changing the parent's `justifyContent` (which would affect the left-aligned status counts) and keeps the layout change minimal.

**Alternatives considered:**
- Changing `justifyContent` to `"space-between"` — rejected because it would alter the spacing of the existing left-aligned items.
- Using `position: "absolute"` — rejected as it complicates layout and is not idiomatic for a simple flex row.

### Decision 2: Conditional rendering of the version `Text`
The version `Text` is rendered only when `version` is truthy. This preserves the existing "no appInfo rendering" behavior (the `does not render app name or version` test at line 909 must remain green) and avoids an empty right-aligned gap when no version is provided.

### Decision 3: Thread `appInfo` (not a bare `version`) through `InputArea`
`InputArea` accepts an `appInfo` prop and passes `appInfo?.version` to `<StatusBar>`. This mirrors how `App` already receives `appInfo` and keeps the prop surface consistent. Optional chaining (`appInfo?.version`) safely handles the case where `appInfo` is undefined/null.

### Decision 4: Use `React.createElement` (no JSX)
The `StatusBar` component uses `React.createElement` rather than JSX. New elements must follow that existing pattern to stay consistent with the file's style.

## Risks / Trade-offs

- **[Risk] Empty right-aligned gap when no version is provided** → Mitigation: the version `Text` is rendered only when `version` is truthy, so no gap appears.
- **[Risk] `appInfo` may be undefined/null at the call site** → Mitigation: use `appInfo?.version` optional chaining.
- **[Risk] Spec drift** → Mitigation: the `app-identity` spec is updated via a delta to reflect that the version is now displayed persistently in the status bar.
