# Spec Delta

## ADDED Requirements

### Requirement: Mouse click detection
`useMouseScroll` SHALL invoke `onClick({x, y})` when a left-button release occurs at the same cell as the press with no movement in between. Drags SHALL NOT invoke `onClick` and SHALL continue through the selection path.

#### Scenario: Click fires
- **WHEN** a left press and release occur on the same cell
- **THEN** `onClick` is called with that cell

#### Scenario: Drag does not click
- **WHEN** the pointer moves to another cell before release, even if it returns to the start
- **THEN** `onClick` is not called and `onSelect` is called

### Requirement: Link spans from rendered output
The markdown renderer SHALL record `{text, href}` for each link in both the OSC 8 and the `text (url)` forms, and the parse cache SHALL return that metadata with the rendered text.

#### Scenario: Spans recorded
- **WHEN** markdown containing a link is parsed
- **THEN** the result includes a span with the visible text and the href

### Requirement: Rendered-text hit-testing
A click SHALL be mapped to a link using the block rect, scroll offset, viewport and wrapped rendered lines, not the raw markdown.

#### Scenario: Wrapped and scrolled
- **WHEN** a link wraps onto a second line or the list is scrolled
- **THEN** a click on its displayed cells resolves to its href and a click elsewhere resolves to nothing

### Requirement: Safe URL opening
Only `http`, `https` and `mailto` URLs, validated with `new URL()`, SHALL be opened, via a spawned process with an args array and no shell. Failures SHALL be logged.

#### Scenario: Disallowed protocol
- **WHEN** the href uses `javascript:`, `file:` or `data:`
- **THEN** nothing is spawned

### Requirement: Click gating
The app SHALL open links only when the conversation panel has mouse focus, the view is the conversation and the file picker is closed.

#### Scenario: Input focused
- **WHEN** the input has focus
- **THEN** no link is opened by the app
