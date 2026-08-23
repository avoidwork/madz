# seo-analysis Specification

## Purpose
TBD - created by archiving change add-text-processing-tools. Update Purpose after archive.
## Requirements
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

