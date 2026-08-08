## ADDED Requirements

### Requirement: Terminal renderer produces styled markdown output
The system SHALL render markdown to ANSI terminal text using a custom `TerminalRenderer` class extending `marked.Renderer`, replacing the `marked-terminal` package entirely.

#### Scenario: Headings render with section prefix and styling
- **WHEN** markdown contains `# Heading 1` or `## Heading 2`
- **THEN** the output includes the section prefix (`# `, `## `) and applies the configured heading style (green bold for h2+, magenta underline bold for h1)

#### Scenario: Paragraphs render with optional reflow
- **WHEN** markdown contains a paragraph longer than terminal width
- **THEN** the output wraps text to terminal width when `reflowText` option is enabled, preserving ANSI styles across line breaks

#### Scenario: Bold text renders with bold style
- **WHEN** markdown contains `**bold text**`
- **THEN** the output applies the configured bold style (chalk.bold)

#### Scenario: Italic text renders with italic style
- **WHEN** markdown contains `*italic text*` or `_italic text_`
- **THEN** the output applies the configured italic style (chalk.italic)

#### Scenario: Strikethrough renders with del style
- **WHEN** markdown contains `~~strikethrough~~`
- **THEN** the output applies the configured del style (dim gray strikethrough)

### Requirement: Code blocks render with syntax highlighting
The system SHALL render code blocks with syntax highlighting using `cli-highlight`, falling back to plain styled text when `chalk.level === 0`.

#### Scenario: Code block with language hint renders highlighted
- **WHEN** markdown contains a fenced code block with a language hint (e.g., ```javascript)
- **THEN** the output applies syntax highlighting via `cli-highlight`

#### Scenario: Code block in color-disabled environment falls back
- **WHEN** `chalk.level === 0` and a code block is rendered
- **THEN** the output uses plain styled text without syntax highlighting

#### Scenario: Inline code renders with codespan style
- **WHEN** markdown contains `` `inline code` ``
- **THEN** the output applies the configured codespan style (yellow)

### Requirement: Links render with hyperlink support
The system SHALL render links with terminal hyperlinks when the terminal supports them, falling back to plain text with the URL.

#### Scenario: Link renders as hyperlink when supported
- **WHEN** markdown contains `[text](url)` and the terminal supports hyperlinks
- **THEN** the output uses `ansi-escapes.link()` to create a clickable hyperlink

#### Scenario: Link renders as plain text when hyperlinks unsupported
- **WHEN** markdown contains `[text](url)` and the terminal does not support hyperlinks
- **THEN** the output displays the URL as styled plain text

#### Scenario: Link with title renders correctly
- **WHEN** markdown contains `[text](url "title")`
- **THEN** the output displays the link text and URL correctly

### Requirement: Lists render with proper nesting
The system SHALL render ordered and unordered lists with proper nested list handling, preventing visual joining of parent lines.

#### Scenario: Unordered list renders with bullet points
- **WHEN** markdown contains `- item` or `* item`
- **THEN** the output renders each item with a bullet prefix (`* `)

#### Scenario: Ordered list renders with sequential numbers
- **WHEN** markdown contains `1. item`
- **THEN** the output renders each item with sequential numbering (1., 2., 3., ...)

#### Scenario: Nested list items do not visually join parent
- **WHEN** markdown contains nested list items
- **THEN** the output places nested items on new lines with proper indentation, preventing the nested item from joining the parent's last line

#### Scenario: Ordered list numbering continues across nested groups
- **WHEN** markdown contains multiple ordered list groups with nesting
- **THEN** the output maintains correct numbering continuation across nested groups

### Requirement: Blockquotes render with styling
The system SHALL render blockquotes with configurable indentation and styling.

#### Scenario: Blockquote renders with indentation and style
- **WHEN** markdown contains `> quoted text`
- **THEN** the output indents the text by the configured tab width and applies the configured blockquote style (gray italic)

### Requirement: Task checkboxes render as text markers
The system SHALL render task list checkboxes as `[X]` for checked items and `[ ]` for unchecked items.

#### Scenario: Checked task renders as [X]
- **WHEN** markdown contains `- [x] completed task`
- **THEN** the output renders `[X] ` before the task text

#### Scenario: Unchecked task renders as [ ]
- **WHEN** markdown contains `- [ ] pending task`
- **THEN** the output renders `[ ] ` before the task text

### Requirement: Tables render with alignment and borders
The system SHALL render markdown tables using `cli-table3` for cell alignment, borders, and multi-line cell support.

#### Scenario: Simple table renders with borders
- **WHEN** markdown contains a GFM table with header and rows
- **THEN** the output renders the table with cell borders and alignment via `cli-table3`

#### Scenario: Multi-line table cells render correctly
- **WHEN** markdown contains a table with multi-line cell content
- **THEN** the output renders each line within the cell boundaries

### Requirement: Horizontal rule renders as dashed line
The system SHALL render `---` as a horizontal rule spanning the terminal width.

#### Scenario: HR renders as dashes
- **WHEN** markdown contains `---`
- **THEN** the output renders a line of dashes spanning the configured width

### Requirement: Images render as fallback text
The system SHALL render images as fallback text in the format `[alt](href)`.

#### Scenario: Image with alt text renders as fallback
- **WHEN** markdown contains `![alt text](url)`
- **THEN** the output renders `[alt text](url)`

### Requirement: Text reflow is ANSI-aware
The system SHALL measure text length by stripping ANSI escape codes before wrapping, ensuring correct terminal column positioning.

#### Scenario: Styled text reflows correctly
- **WHEN** markdown contains styled text (bold, colored) that exceeds terminal width
- **THEN** the output wraps at the correct column boundary, accounting for ANSI escape code length

### Requirement: Emoji rendering converts shortcodes
The system SHALL convert emoji shortcodes (e.g., `:smile:`) to actual emoji characters using `node-emoji`.

#### Scenario: Emoji shortcode renders as emoji character
- **WHEN** markdown contains `:smile:`
- **THEN** the output renders the actual smiley emoji character

#### Scenario: Emoji shortcode in code spans is escaped
- **WHEN** markdown contains `:smile:` inside a code span or code block
- **THEN** the output renders the literal text `:smile:` without emoji conversion

### Requirement: HTML entities are unescaped
The system SHALL convert HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) back to their character equivalents.

#### Scenario: HTML entities are converted
- **WHEN** markdown contains `&amp;` or `&lt;` or `&gt;`
- **THEN** the output renders `&`, `<`, `>` respectively

### Requirement: Configurable styling matches marked-terminal defaults
The system SHALL provide a `defaultOptions` object with configurable chalk styles for all rendered elements, matching `marked-terminal`'s default options pattern.

#### Scenario: Default options include all element styles
- **WHEN** the renderer is instantiated without custom options
- **THEN** the renderer uses default styles: heading (green bold), firstHeading (magenta underline bold), blockquote (gray italic), code (yellow), strong (bold), em (italic), codespan (yellow), del (dim gray strikethrough), link (blue), href (blue underline), hr (reset), listitem (reset), paragraph (reset), list (reset), table (reset), text (identity)

#### Scenario: Custom options override defaults
- **WHEN** the renderer is instantiated with custom options
- **THEN** the custom options override the corresponding default styles

### Requirement: Hard and soft line breaks are distinguished
The system SHALL distinguish between hard breaks (`\r`, no reflow) and soft breaks (`\n`, reflow allowed), and handle `<br />` in GFM mode.

#### Scenario: Hard break prevents reflow
- **WHEN** markdown contains a hard break (double space followed by newline)
- **THEN** the output uses `\r` to prevent text reflow across the break

#### Scenario: Soft break allows reflow
- **WHEN** markdown contains a soft break (single newline)
- **THEN** the output uses `\n` allowing text reflow across the break

#### Scenario: GFM br tag renders as hard break
- **WHEN** markdown contains `<br />` in GFM mode
- **THEN** the output treats it as a hard break (same as `\r`)

### Requirement: Tab handling is configurable
The system SHALL support configurable tab width (default 4 spaces) with proper indentation for blockquotes and list nesting.

#### Scenario: Default tab width is 4 spaces
- **WHEN** the renderer is instantiated without custom options
- **THEN** tab characters and indentation use 4 spaces

#### Scenario: Custom tab width is respected
- **WHEN** the renderer is instantiated with `tab: 2`
- **THEN** tab characters and indentation use 2 spaces

### Requirement: HTML sanitization prevents XSS
The system SHALL sanitize link hrefs to prevent javascript: URI injection when the `sanitize` option is enabled.

#### Scenario: javascript: link is blocked
- **WHEN** markdown contains `[click](javascript:alert(1))` and sanitize is enabled
- **THEN** the output renders an empty string (link is blocked)

### Requirement: Renderer API is compatible with marked.setOptions()
The system SHALL export a `createTerminalRenderer()` factory function that produces a renderer compatible with `marked.setOptions({ renderer: new TerminalRenderer() })`.

#### Scenario: Factory function produces usable renderer
- **WHEN** `createTerminalRenderer()` is called with options
- **THEN** the returned renderer can be passed to `marked.setOptions()` and produces correct output
