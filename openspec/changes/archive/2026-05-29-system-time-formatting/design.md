## Context

`src/tui/conversationPanel.js` defines `formatTime(date)` which concatenates `date.getHours()` and `date.getMinutes()` with zero-padding. Every message render calls this function, computing two method calls per invocation. The output is always `HH:MM` (24-hour, no seconds, no localization), regardless of the user's system locale.

## Goals / Non-Goals

**Goals:**
- Use `Intl.DateTimeFormat` with the system default locale for time formatting.
- Cache the formatter as a module-level `const` so it is created once and reused.

**Non-Goals:**
- Adding time-zone configuration or user-selectable formats (future work).
- Formatting dates alongside times.
- Changing the memory panel timestamp display.

## Decisions

1. **Use `new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })`**
   - Passing `undefined` as the first argument uses the runtime's default locale, matching the user's system settings.
   - `{ hour: "numeric", minute: "2-digit" }` preserves the existing 2-digit minute behavior while adopting locale-aware hour formatting (12-hour vs 24-hour).

2. **Cache formatter in a module-level `const`**
   - `Intl.DateTimeFormat` instantiation carries a small overhead. Caching at module scope ensures a single instance for the lifetime of the TUI process.

3. **Keep the same function name `formatTime(date)` but change its internals**
   - No callers outside this module — renaming is unnecessary churn.

## Risks / Trade-offs

[Risk] Output format may change visually (e.g., `2:30 PM` vs `14:30` on en-US locale). → **Mitigation**: This is the intended behavior — localized formatting.
[Risk] Node.js `Intl` support varies by runtime build. → **Mitigation**: Node 20+ (project requirement) ships with full ICU by default.
