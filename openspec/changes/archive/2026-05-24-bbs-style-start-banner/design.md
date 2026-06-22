## Context

The TUI (Terminal User Interface) currently launches directly into the chat panel with no visual onboarding. Users are unaware of available slash commands (`:provider`, `:memory`, `:schedule`, `:quit`, etc.) until they discover them. The TUI uses Ink/React for rendering components in the terminal.

## Goals / Non-Goals

**Goals:**
- Render a visually appealing startup banner with ASCII art and a built-in commands help menu.
- Display the banner once on TUI launch in interactive mode.
- Allow users to dismiss the banner to transition to the normal chat view.
- Keep the banner non-blocking -- it does not interrupt app initialization.

**Non-Goals:**
- Persist banner display across sessions (user never sees it again after dismissal).
- Customize banner content via configuration or settings.
- Animate or re-render the banner after dismissal.

## Decisions

1. **Banner rendered inside `App` component, not as a separate entry point.**
   The banner integrates into the existing `src/tui/app.js` React tree using a state flag (`showBanner`). This avoids restructuring `index.js` or creating new Ink renderers.
   *Alternative*: Render banner from `index.js` before Ink renders the App. Rejected because it would require an extra Ink render and would be harder to dismiss cleanly.

2. **Banner is a separate component in `src/tui/components.js`.**
   Follows existing pattern (ConversationPanel, StatusBar, etc.) for reusability and testability.
   *Alternative*: Inline the banner JSX in `app.js`. Rejected because it increases App complexity and makes unit testing harder.

3. **Banner dismissed via any keystroke.**
   The simplest UX: any key press dismisses the banner. This avoids adding a new command.
   *Alternative*: Dismiss only via `:help` or `:dismiss` command. Rejected because it adds friction to the first interaction.

4. **Banner shows in interactive mode only.**
   CLI/`--mode chat` mode does not show the banner. Interactive mode is determined by `index.js` passing a `showBanner` flag or the TUI detecting it.
   *Alternative*: Always show the banner. Rejected because batch/CLI users would find it disruptive.

## Risks / Trade-offs

- **[Risk] Banner layout breaks on narrow terminals.** → Mitigation: Use a fixed-width monospaced layout and truncate/wrap command examples gracefully. Test with minimum 80-column width.
- **[Risk] Banner slows initial render.** → Mitigation: The banner is static content, not computed. No performance impact.
- **[Risk] Users miss the banner because it auto-dismisses.** → Mitigation: The banner remains until explicitly dismissed (no auto-dismiss timer).
