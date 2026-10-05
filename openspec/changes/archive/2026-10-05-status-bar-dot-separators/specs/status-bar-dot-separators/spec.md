## ADDED Requirements

### Requirement: Status bar left side uses dot separators instead of brackets
The TUI status bar left side SHALL render each element with a light floating dot (`∙`, U+2219) separator instead of `[ ]` brackets. The model name SHALL be the first element after the streaming indicator and SHALL NOT have a dot. Every element after the model name (skills, messages, context, tokens, project) SHALL have a `∙` dot to its left.

#### Scenario: Model name has no dot
- **WHEN** the status bar renders with a model name and other elements
- **THEN** the model name renders with no leading dot, and each subsequent element renders with a `∙` dot to its left

#### Scenario: No brackets render
- **WHEN** the status bar renders any left-side element
- **THEN** no `[` or `]` bracket characters appear in the rendered left-side output

### Requirement: Dot-space-glyph spacing
Each element after the model name SHALL render as `∙ ` + glyph + ` ` + value, with a space between the dot and the glyph and a space between the glyph and the value.

#### Scenario: Skills element spacing
- **WHEN** the status bar renders the skills element with a count
- **THEN** it renders as `∙ ⚡ <count>` with a space between the dot and the glyph and a space between the glyph and the count

#### Scenario: Messages element spacing
- **WHEN** the status bar renders the messages element with a count
- **THEN** it renders as `∙ 💬 <count>` with a space between the dot and the glyph and a space between the glyph and the count

#### Scenario: Context element spacing
- **WHEN** the status bar renders the context element with a size
- **THEN** it renders as `∙ ▦ <size>` with a space between the dot and the glyph and a space between the glyph and the size

#### Scenario: Tokens element spacing
- **WHEN** the status bar renders the tokens element with a count and budget
- **THEN** it renders as `∙ 💎 <count>/<budget>` with a space between the dot and the glyph and a space between the glyph and the values

#### Scenario: Project element spacing
- **WHEN** the status bar renders the project element with a name
- **THEN** it renders as `∙ <project-name>` with a space between the dot and the name

### Requirement: SI postfix for context and token numbers
The status bar SHALL apply SI postfix formatting (e.g., `12.2k`, `1.4M`) to context-window-centric numbers: context size (`▦`) and token count/budget (`💎`). Skills (`⚡`) and messages (`💬`) counts SHALL NOT use SI postfix.

#### Scenario: Context size uses SI postfix
- **WHEN** the context size is a large number
- **THEN** it renders with SI postfix (e.g., `12.2k`, `1.4M`)

#### Scenario: Token budget uses SI postfix
- **WHEN** the token count or budget is a large number
- **THEN** it renders with SI postfix (e.g., `12.2k`, `1.4M`)

#### Scenario: Skills count does not use SI postfix
- **WHEN** the skills count is a large number
- **THEN** it renders as a plain count with no SI postfix

#### Scenario: Messages count does not use SI postfix
- **WHEN** the messages count is a large number
- **THEN** it renders as a plain count with no SI postfix
