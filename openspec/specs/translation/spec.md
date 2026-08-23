# translation Specification

## Purpose
Defines the translator subagent's capabilities for multi-language translation and language detection using the existing LLM integration.

## Requirements

### Requirement: Translator subagent handles translation
The translator subagent SHALL translate text between languages with cultural and contextual accuracy when invoked with a translation request.

#### Scenario: Translate English to Spanish
- **WHEN** the user provides text and specifies a target language (e.g., "es")
- **THEN** the subagent returns the translated text in the target language

#### Scenario: Translate with source language specified
- **WHEN** the user provides text, source language, and target language
- **THEN** the subagent returns the translated text using the specified source language context

### Requirement: Translator subagent handles language detection
The translator subagent SHALL identify the source language of input text when invoked with a language detection request.

#### Scenario: Detect English text
- **WHEN** the user provides English text and requests language detection
- **THEN** the subagent returns the detected language as "en"

#### Scenario: Detect non-English text
- **WHEN** the user provides non-English text and requests language detection
- **THEN** the subagent returns the detected language code

### Requirement: Translator subagent preserves meaning and context
The translator subagent SHALL prioritize meaning preservation over literal word substitution when translating.

#### Scenario: Translate idiomatic expressions
- **WHEN** the user provides text containing idiomatic expressions
- **THEN** the subagent returns translated text that preserves the idiomatic meaning in the target language

#### Scenario: Translate with tone preservation
- **WHEN** the user provides text with a specific tone or register
- **THEN** the subagent returns translated text that preserves the original tone

### Requirement: Translator subagent respects input limits
The translator subagent SHALL reject inputs exceeding 10,000 characters with a clear error message.

#### Scenario: Reject oversized input
- **WHEN** the user provides text exceeding 10,000 characters
- **THEN** the subagent returns an error indicating the input exceeds the maximum size limit

### Requirement: Translator subagent uses LLM integration
The translator subagent SHALL use the existing ChatOpenAI integration for all translation operations, consistent with other subagents in the system.

#### Scenario: Translate via LLM
- **WHEN** the user requests any translation operation
- **THEN** the subagent invokes the LLM with an appropriate system prompt and returns the translated text