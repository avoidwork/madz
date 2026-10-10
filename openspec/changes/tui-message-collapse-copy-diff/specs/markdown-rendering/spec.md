## MODIFIED Requirements

### Requirement: Fenced code blocks render as multiline blocks
The system SHALL render fenced code blocks as visually separated multiline regions when a message contains a fenced code block delimited by `` ``` ``.

#### Scenario: Fenced code blocks render as multiline blocks
- **WHEN** a message contains a fenced code block delimited by `` ``` ``
- **THEN** the terminal displays the block as a visually separated multiline region

### Requirement: Fenced code blocks expose a copy affordance
The markdown renderer SHALL expose a `[copy]` affordance on fenced code blocks so users can copy the code content to the clipboard. The affordance SHALL be rendered by the component layer (not the pure renderer), which receives a copy callback.

#### Scenario: Fenced code blocks expose a copy affordance
- **WHEN** a message contains a fenced code block
- **THEN** the component layer renders a `[copy]` affordance alongside the code block
