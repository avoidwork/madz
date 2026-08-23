# text-processing Specification

## Purpose
Defines the text-editor subagent's capabilities for text processing operations including summarization, rewriting, tone adjustment, grammar correction, and length modification.

## Requirements

### Requirement: Text editor subagent handles summarization
The textEditor subagent SHALL accept text input and produce a concise summary that captures all key points when invoked with a summarization request.

#### Scenario: Summarize short text
- **WHEN** the user provides text and requests a summary
- **THEN** the subagent returns a concise summary that preserves all key information

#### Scenario: Summarize long text
- **WHEN** the user provides text exceeding 5000 characters and requests a summary
- **THEN** the subagent returns a summary that captures the essential points without losing critical context

### Requirement: Text editor subagent handles rewriting
The textEditor subagent SHALL accept text input and rewrite it according to specified tone, style, or structural requirements while preserving the original meaning.

#### Scenario: Rewrite with tone adjustment
- **WHEN** the user provides text and specifies a target tone (e.g., "professional", "casual")
- **THEN** the subagent returns rewritten text matching the specified tone

#### Scenario: Rewrite preserving meaning
- **WHEN** the user provides text for rewriting
- **THEN** the subagent returns rewritten text that preserves all original facts and key information

### Requirement: Text editor subagent handles grammar correction
The textEditor subagent SHALL accept text input and correct all grammatical, spelling, and punctuation errors while preserving the original meaning and style.

#### Scenario: Correct grammatical errors
- **WHEN** the user provides text with grammatical errors
- **THEN** the subagent returns corrected text with all errors fixed

#### Scenario: Preserve style during correction
- **WHEN** the user provides text with a distinctive voice or style
- **THEN** the subagent corrects errors without altering the distinctive voice

### Requirement: Text editor subagent handles length modification
The textEditor subagent SHALL accept text input and either condense or expand it while preserving the core message.

#### Scenario: Shorten text
- **WHEN** the user provides text and requests it to be shortened
- **THEN** the subagent returns condensed text preserving the core message

#### Scenario: Expand text
- **WHEN** the user provides text and requests it to be expanded
- **THEN** the subagent returns elaborated text with relevant detail added

### Requirement: Text editor subagent respects input limits
The textEditor subagent SHALL reject inputs exceeding 10,000 characters with a clear error message.

#### Scenario: Reject oversized input
- **WHEN** the user provides text exceeding 10,000 characters
- **THEN** the subagent returns an error indicating the input exceeds the maximum size limit

### Requirement: Text editor subagent uses LLM integration
The textEditor subagent SHALL use the existing ChatOpenAI integration for all text processing operations, consistent with other subagents in the system.

#### Scenario: Process text via LLM
- **WHEN** the user requests any text processing operation
- **THEN** the subagent invokes the LLM with an appropriate system prompt and returns the processed result