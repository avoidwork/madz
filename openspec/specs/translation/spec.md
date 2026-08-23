# translation Specification

## Purpose
TBD - created by archiving change add-text-processing-tools. Update Purpose after archive.
## Requirements
### Requirement: Translate tool supports translation
The translate tool SHALL accept a "translate" action that translates input text to a target language.

#### Scenario: Translate English to Spanish
- **WHEN** the user calls the translate tool with action "translate", input "Hello world", and options { targetLanguage: "es" }
- **THEN** the tool returns structured JSON with result containing the Spanish translation

#### Scenario: Translate with source language specified
- **WHEN** the user calls the translate tool with action "translate", input text, and options { sourceLanguage: "en", targetLanguage: "fr" }
- **THEN** the tool returns structured JSON with the French translation

### Requirement: Translate tool supports language detection
The translate tool SHALL accept a "detect" action that identifies the language of the input text.

#### Scenario: Detect English text
- **WHEN** the user calls the translate tool with action "detect" and input "Hello world"
- **THEN** the tool returns structured JSON with result containing { language: "en", confidence: number }

#### Scenario: Detect Spanish text
- **WHEN** the user calls the translate tool with action "detect" and input "Hola mundo"
- **THEN** the tool returns structured JSON with result containing { language: "es", confidence: number }

### Requirement: Translate tool caching
The translate tool SHALL cache translation results by (input, sourceLanguage, targetLanguage) key with a 24-hour TTL.

#### Scenario: Cached translation result
- **WHEN** the user calls the translate tool with the same (input, sourceLanguage, targetLanguage) twice within 24 hours
- **THEN** the second call returns the cached result without making a new API request

#### Scenario: Expired cache
- **WHEN** the user calls the translate tool with a cached key that is older than 24 hours
- **THEN** the tool makes a new API request and updates the cache

### Requirement: Translate tool input validation
The translate tool SHALL validate all inputs against a zod schema before processing.

#### Scenario: Missing input field
- **WHEN** the user calls the translate tool without an "input" field
- **THEN** the tool returns a validation error

#### Scenario: Input exceeds size limit
- **WHEN** the user calls the translate tool with input text exceeding 10,000 characters
- **THEN** the tool returns an error indicating the input exceeds the maximum size limit

### Requirement: Translate tool structured output
The translate tool SHALL return structured JSON output with result, action, and metadata fields.

#### Scenario: Successful translation
- **WHEN** the translate tool processes a valid request
- **THEN** the tool returns JSON with { result: string, action: string, metadata: { sourceLanguage: string, targetLanguage: string, cached: boolean } }

