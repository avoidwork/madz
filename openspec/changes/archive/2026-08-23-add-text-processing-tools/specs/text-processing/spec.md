## ADDED Requirements

### Requirement: Text tool supports summarize action
The text tool SHALL accept a "summarize" action that produces a condensed version of the input text.

#### Scenario: Summarize normal text
- **WHEN** the user calls the text tool with action "summarize", input text of 500+ characters, and options { targetLength: 100 }
- **THEN** the tool returns structured JSON with result containing a summary of approximately 100 characters

#### Scenario: Summarize short text
- **WHEN** the user calls the text tool with action "summarize" and input text of 50 characters
- **THEN** the tool returns the input text unchanged (no summarization needed)

### Requirement: Text tool supports rewrite action
The text tool SHALL accept a "rewrite" action that rephrases the input text while preserving meaning.

#### Scenario: Rewrite with different tone
- **WHEN** the user calls the text tool with action "rewrite", input text, and options { tone: "professional" }
- **THEN** the tool returns structured JSON with result containing a professionally toned rewrite

#### Scenario: Rewrite without tone option
- **WHEN** the user calls the text tool with action "rewrite" and input text without tone option
- **THEN** the tool returns a rephrased version of the input text

### Requirement: Text tool supports tone adjustment
The text tool SHALL accept a "tone" action that adjusts the tone of the input text.

#### Scenario: Adjust to formal tone
- **WHEN** the user calls the text tool with action "tone", input text, and options { tone: "formal" }
- **THEN** the tool returns structured JSON with result containing the text adjusted to a formal tone

#### Scenario: Adjust to casual tone
- **WHEN** the user calls the text tool with action "tone", input text, and options { tone: "casual" }
- **THEN** the tool returns structured JSON with result containing the text adjusted to a casual tone

### Requirement: Text tool supports grammar correction
The text tool SHALL accept a "grammar" action that corrects grammatical errors in the input text.

#### Scenario: Correct grammar errors
- **WHEN** the user calls the text tool with action "grammar" and input text containing grammatical errors
- **THEN** the tool returns structured JSON with result containing the corrected text

#### Scenario: Text with no errors
- **WHEN** the user calls the text tool with action "grammar" and grammatically correct input text
- **THEN** the tool returns the input text unchanged

### Requirement: Text tool supports length adjustment
The text tool SHALL accept "shorten" and "expand" actions that adjust the length of the input text.

#### Scenario: Shorten text
- **WHEN** the user calls the text tool with action "shorten", input text of 500+ characters, and options { targetLength: 200 }
- **THEN** the tool returns structured JSON with result containing a shortened version of approximately 200 characters

#### Scenario: Expand text
- **WHEN** the user calls the text tool with action "expand", input text of 50 characters, and options { targetLength: 200 }
- **THEN** the tool returns structured JSON with result containing an expanded version of approximately 200 characters

### Requirement: Text tool input validation
The text tool SHALL validate all inputs against a zod schema before processing.

#### Scenario: Missing input field
- **WHEN** the user calls the text tool without an "input" field
- **THEN** the tool returns a validation error

#### Scenario: Input exceeds size limit
- **WHEN** the user calls the text tool with input text exceeding 10,000 characters
- **THEN** the tool returns an error indicating the input exceeds the maximum size limit

### Requirement: Text tool structured output
The text tool SHALL return structured JSON output with result, action, and metadata fields.

#### Scenario: Successful text operation
- **WHEN** the text tool processes a valid request
- **THEN** the tool returns JSON with { result: string, action: string, metadata: { inputLength: number, outputLength: number } }

## ADDED Requirements

### Requirement: SEO tool supports keyword density analysis
The seo tool SHALL accept a "keyword-density" action that analyzes keyword frequency in the input text.

#### Scenario: Analyze keyword density
- **WHEN** the user calls the seo tool with action "keyword-density", input text, and keywords ["seo", "marketing"]
- **THEN** the tool returns structured JSON with keyword density percentages for each keyword

#### Scenario: No keywords provided
- **WHEN** the user calls the seo tool with action "keyword-density" and input text but no keywords
- **THEN** the tool returns an error indicating keywords are required

### Requirement: SEO tool supports meta description generation
The seo tool SHALL accept a "meta-description" action that generates an SEO-optimized meta description.

#### Scenario: Generate meta description
- **WHEN** the user calls the seo tool with action "meta-description", input text, and options { targetKeywords: ["seo", "marketing"] }
- **THEN** the tool returns structured JSON with a meta description under 160 characters containing the target keywords

#### Scenario: Generate meta description without keywords
- **WHEN** the user calls the seo tool with action "meta-description" and input text without target keywords
- **THEN** the tool returns a meta description under 160 characters based on the input text

### Requirement: SEO tool input validation
The seo tool SHALL validate all inputs against a zod schema before processing.

#### Scenario: Missing input field
- **WHEN** the user calls the seo tool without an "input" field
- **THEN** the tool returns a validation error

#### Scenario: Input exceeds size limit
- **WHEN** the user calls the seo tool with input text exceeding 10,000 characters
- **THEN** the tool returns an error indicating the input exceeds the maximum size limit

### Requirement: SEO tool structured output
The seo tool SHALL return structured JSON output with result, action, and metadata fields.

#### Scenario: Successful SEO operation
- **WHEN** the seo tool processes a valid request
- **THEN** the tool returns JSON with { result: object, action: string, metadata: { inputLength: number } }

## ADDED Requirements

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