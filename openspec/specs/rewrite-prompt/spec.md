# rewrite-prompt Specification

## Purpose
TBD - created by archiving change rewrite-prompt-system-skill. Update Purpose after archive.
## Requirements
### Requirement: Skill accepts raw prompt input
The rewrite-prompt skill SHALL accept a raw user prompt as input via stdin or file argument.

#### Scenario: Prompt via stdin
- **WHEN** user pipes a raw prompt to the skill script
- **THEN** the script reads the input and processes it for rewriting

#### Scenario: Prompt via file argument
- **WHEN** user provides a file path as an argument
- **THEN** the script reads the file contents and processes them for rewriting

### Requirement: Skill rewrites for clarity
The rewrite-prompt skill SHALL rewrite vague or ambiguous prompts to improve clarity by identifying missing context and restructuring for expressiveness.

#### Scenario: Vague prompt becomes specific
- **WHEN** user provides a vague prompt like "write code for a list"
- **THEN** the rewritten prompt adds context about data structure, operations, and expected output format

#### Scenario: Ambiguous prompt becomes unambiguous
- **WHEN** user provides an ambiguous prompt like "make it better"
- **THEN** the rewritten prompt asks for clarification on what "better" means (performance, readability, etc.)

### Requirement: Skill structures the request
The rewrite-prompt skill SHALL restructure unstructured prompts into a clear format: context → task → constraints → output format.

#### Scenario: Unstructured prompt gets structured
- **WHEN** user provides a rambling, unstructured prompt
- **THEN** the rewritten prompt organizes the request into clear sections: context, task, constraints, and expected output

#### Scenario: Already-structured prompt is preserved
- **WHEN** user provides a well-structured prompt
- **THEN** the rewritten prompt maintains the structure with minor improvements

### Requirement: Skill adds relevant context
The rewrite-prompt skill SHALL identify and add relevant context that the LLM needs but the user omitted, such as environment details, constraints, or expected behavior.

#### Scenario: Missing environment context added
- **WHEN** user provides a prompt without environment details
- **THEN** the rewritten prompt includes placeholders or suggestions for environment context (Node.js version, framework, etc.)

#### Scenario: User-provided context is preserved
- **WHEN** user includes context in their prompt
- **THEN** the rewritten prompt preserves and enhances the user's context without removing it

### Requirement: Skill makes the prompt actionable
The rewrite-prompt skill SHALL transform passive or open-ended prompts into actionable requests with clear success criteria.

#### Scenario: Open-ended prompt becomes actionable
- **WHEN** user provides an open-ended prompt like "tell me about sorting"
- **THEN** the rewritten prompt specifies the sorting algorithm, language, and expected output

#### Scenario: Passive prompt becomes active
- **WHEN** user provides a passive prompt like "I need help with"
- **THEN** the rewritten prompt clearly states the task and expected deliverable

### Requirement: Skill preserves user intent
The rewrite-prompt skill SHALL preserve the user's original intent while enhancing expressiveness. Rewriting must not change what the user is asking for.

#### Scenario: Intent preserved through rewriting
- **WHEN** user provides a prompt with a specific intent
- **THEN** the rewritten prompt maintains the same intent with improved clarity

#### Scenario: No hallucinated context added
- **WHEN** user provides a prompt without certain details
- **THEN** the rewritten prompt does not invent context or assumptions about what the user wants

### Requirement: Skill handles edge cases
The rewrite-prompt skill SHALL handle edge cases gracefully: empty input, already-well-structured prompts, and very long prompts.

#### Scenario: Empty input handled
- **WHEN** user provides an empty or whitespace-only prompt
- **THEN** the script returns an error message indicating no input was provided

#### Scenario: Already-structured prompt minimally modified
- **WHEN** user provides a well-structured, clear prompt
- **THEN** the rewritten prompt is nearly identical to the input with only minor improvements

#### Scenario: Very long prompt processed
- **WHEN** user provides a very long prompt
- **THEN** the script processes the full prompt without truncation and produces a coherent rewrite

