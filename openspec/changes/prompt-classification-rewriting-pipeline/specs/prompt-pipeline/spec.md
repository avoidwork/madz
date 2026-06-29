## ADDED Requirements

### Requirement: Pipeline classifies user prompts into structured metadata
The system SHALL analyze each user prompt and assign classification metadata including intent, domain, and complexity using an LLM-based classification call.

#### Scenario: Valid prompt classification
- **WHEN** a user submits a prompt such as "Write a Python function to sort a list"
- **THEN** the pipeline returns metadata with intent="task", domain="coding", complexity="moderate"

#### Scenario: Question prompt classification
- **WHEN** a user submits a prompt such as "What is the difference between let and const?"
- **THEN** the pipeline returns metadata with intent="question", domain="coding", complexity="simple"

#### Scenario: Creative prompt classification
- **WHEN** a user submits a prompt such as "Write a short story about a robot learning to love"
- **THEN** the pipeline returns metadata with intent="creative", domain="writing", complexity="moderate"

#### Scenario: Classification error fallback
- **WHEN** the LLM classification call fails
- **THEN** the pipeline returns default metadata (intent="other", domain="general", complexity="moderate") without blocking the agent flow

### Requirement: Pipeline rewrites user prompts into optimized format
The system SHALL take the original user prompt plus classification metadata and produce a rewritten, optimized prompt using a second LLM call.

#### Scenario: Valid prompt rewriting
- **WHEN** a user submits a vague prompt such as "fix it"
- **THEN** the pipeline rewrites it into a structured prompt that clarifies intent and adds relevant context based on classification metadata

#### Scenario: Rewriting preserves original intent
- **WHEN** a user submits a detailed prompt such as "Create a REST API with Express.js that handles user authentication"
- **THEN** the rewritten prompt preserves the original technical requirements while normalizing structure

#### Scenario: Rewriting error fallback
- **WHEN** the LLM rewriting call fails
- **THEN** the pipeline returns the original unmodified prompt without blocking the agent flow

### Requirement: Pipeline integrates into agent flow before message construction
The system SHALL intercept raw user input in `callReactAgent()` before `HumanMessage` construction, execute classification and rewriting sequentially, and pass the rewritten prompt to the agent graph.

#### Scenario: Pipeline executes before HumanMessage construction
- **WHEN** a user submits a message through the TUI
- **THEN** the pipeline processes the message (classify + rewrite) before wrapping it in a `HumanMessage` for the agent graph

#### Scenario: Agent graph receives same message format
- **WHEN** the pipeline processes a user message
- **THEN** the agent graph receives a `HumanMessage` object with the same structure as before, containing the rewritten prompt text

### Requirement: Pipeline is configurable and toggleable
The system SHALL gate the entire pipeline behind a config flag `agent.promptRewrite.enabled` (default: false) so it can be enabled or disabled without code changes.

#### Scenario: Pipeline disabled by default
- **WHEN** the application starts with default configuration
- **THEN** the pipeline is disabled and raw user input passes through unchanged to the agent graph

#### Scenario: Pipeline enabled via config
- **WHEN** `agent.promptRewrite.enabled` is set to `true` in config
- **THEN** the pipeline executes for all user messages, performing classification and rewriting before passing to the agent graph

#### Scenario: Pipeline disabled does not affect agent flow
- **WHEN** the pipeline is disabled
- **THEN** the agent graph receives raw user input exactly as before, with no behavioral changes

### Requirement: Pipeline modules are composable and testable
The system SHALL structure the pipeline as separate, testable modules: `classifyPrompt()`, `rewritePrompt()`, and `processPrompt()` orchestrator, with prompt templates and category definitions in separate files.

#### Scenario: Classification function is independently testable
- **WHEN** the `classifyPrompt()` function is called with a prompt string
- **THEN** it returns classification metadata without requiring the rewriting module or agent graph

#### Scenario: Rewriting function is independently testable
- **WHEN** the `rewritePrompt()` function is called with a prompt and metadata
- **THEN** it returns a rewritten prompt string without requiring the classification module or agent graph

#### Scenario: Prompt templates are configurable
- **WHEN** the prompt templates in `prompts.js` are modified
- **THEN** the classification and rewriting behavior changes accordingly without code changes to the pipeline logic