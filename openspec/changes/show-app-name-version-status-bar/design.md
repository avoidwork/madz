## Context

The TUI (Ink-based terminal app) renders three bottom rows during normal operation:
- Status bar (line 1 from bottom): status indicator, status message, skill/message counts
- Input panel (line 2 from bottom): IRC-style prompt (`> ` or `: `) and user input text
- Exit newline (line 3 from bottom): blank line for terminal formatting

There is no visible app name or version anywhere on screen. The banner briefly shows project info but disappears on first keypress.

## Goals / Non-Goals

**Goals:**
- Show app name and version pinned to the **far right edge** of the input panel row, separate from user input.

**Non-Goals:**
- Moving the version to the status bar.
- Making the version configurable via config.yaml (it comes from `package.json` at build time).
- Styling the version (color, bold, etc.) — keep it simple.

## Decisions

1. **Place in InputPanel, not StatusBar.** The input panel is the last row before the exit newline, making the version the most permanently visible element. Placing it in the status bar would push the counts to the right and feel cramped.

2. **Format: `> text name v<version>` with identity pinned right.** The identity label is pinned to the **far right edge** of the terminal. The input text fills all available space between the prompt and the identity label using `flex: { grow: 1 }` on the input Text. Example with a 60-column terminal: `> hello world                                  madz v1.0.0`

3. **Pass version as prop from index.js.** `index.js` reads `package.json` for the version string and passes it to `App`. The `App` component forwards it to `InputPanel`. This avoids importing `package.json` in the TUI module directly and keeps the data flow top-down.

4. **Name from config, version from package.json.** The app name uses the existing `config.tui.name` (default `"madz"`), preserving the customization path. The version is read from the project's `package.json` at startup, which is the canonical location.

5. **App name in cyan, version in white.** The app name is rendered in cyan and the version is rendered in white, matching the existing TUI color palette. Format (right side): `prompt + input` + ` ` + `cyan-name` + ` ` + `white-v1.0.0`. This uses two separate `Text` components with different color props, placed after the input Text node.

6. **Right-aligned identity in InputPanel box.** The InputPanel `Box` is `flexDirection: "row"`. The order of children is: (1) prompt Text, (2) input Text with `flex: { grow: 1 }`, (3) name Text (cyan), (4) version Text (white). The grow on input Text forces it to consume all free space, pinning the identity label to the far right edge regardless of input length.

## Risks / Trade-offs

- **Version stale on development builds.** Since version comes from `package.json`, it always reflects the published package version. This is acceptable — developers can see what version they are running via `npm start`.
- **Input text truncated on narrow terminals.** On very narrow screens (less than ~30 columns), the suffix ` madz v1.0.0` may push the visible portion of the user input left, or the input may truncate. The `Text` component in Ink does not truncate overflow by default, so the line may extend past the terminal width. This is acceptable — users can see the rightmost content (the version). Scroll or terminal resize resolves it.
- **No color/styling.** Keeping it unstyled (plain text from InputPanel) minimizes visual changes. Could be refined in a future iteration.
