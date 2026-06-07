## Context

The TUI has an `appInfo` object built in `index.js` from `config.tui.name` and `pkg.version`. It is passed to the `App` component and then forwarded to `StatusBar`. The status bar currently renders `appInfo.name + appInfo.version` on the right side. The `app-identity` spec incorrectly describes the version in the input panel — the code's statusBar placement was the working intent, but now the user wants the version shown only once in the startup banner.

## Goals / Non-Goals

**Goals:**
- Move version display from StatusBar to Banner (below ASCII art)
- Remove `appInfo` prop from StatusBar
- Strip the version from the status bar if only the version was shown there (leaving clean chat + input panel)
- Update the `app-identity` spec to reflect the new requirement

**Non-Goals:**
- Moving version to the input panel (the spec's original claim is acknowledged as incorrect)
- Changing the banner's dismiss behavior or ASCII art
- Removing the `appInfo` object from `index.js` entirely (keeps `index.js` cleaner but preserves forward compatibility)

## Decisions

1. **Version goes in Banner, not StatusBar.**
   - Rationale: The version is a one-time informational string. Showing it only on startup is cleaner than a persistent bottom-bar element. The banner already renders ASCII art and is shown briefly before the user starts interacting.

2. **StatusBar is not removed entirely — only the `appInfo` rendering is removed.**
   - Rationale: StatusBar still renders the status indicator (connected/error/sending), status message, and skill/message counts. These are useful during active use. If `appInfo` was the *only* thing on the right side, the bar keeps its two-column layout but the right segment simply disappears.

3. **`appInfo` remains passed to `App` but is only used for Banner.**
   - Rationale: This minimizes changes to `index.js` and `app.js`. The Banner can receive `appInfo.version` directly. If future work removes the version entirely, `appInfo` can be cleaned up later.

## Risks / Trade-offs

- [Risk] Users who relied on seeing the version during a session will no longer see it. → Mitigation: version is still visible immediately at startup. `--version` CLI flag (if it exists) covers programmatic use.
- [Risk] The `appInfo` prop flows through multiple components but is only consumed by Banner. → Mitigation: accept as a minor technical debt, remove in a follow-up cleanup.
