# seo-analysis Specification

## Purpose
Defines the seo-analyst subagent's capabilities for search engine optimization analysis including keyword density analysis, meta description generation, SERP analysis, and content optimization.

## Requirements

### Requirement: SEO analyst subagent handles keyword density analysis
The seoAnalyst subagent SHALL analyze keyword frequency, percentage, and distribution within text content when invoked with a keyword density request.

#### Scenario: Analyze specific keywords
- **WHEN** the user provides text and target keywords
- **THEN** the subagent returns density percentages, counts, and occurrence data for each keyword

#### Scenario: Analyze most frequent words
- **WHEN** the user provides text without specific keywords
- **THEN** the subagent returns analysis of the most frequently occurring words

### Requirement: SEO analyst subagent handles meta description generation
The seoAnalyst subagent SHALL generate compelling meta descriptions optimized for click-through rates when invoked with a meta description request.

#### Scenario: Generate meta description with target keyword
- **WHEN** the user provides text and a target keyword
- **THEN** the subagent returns a meta description under 160 characters that includes the target keyword

#### Scenario: Generate meta description without target keyword
- **WHEN** the user provides text without a target keyword
- **THEN** the subagent returns a meta description under 160 characters based on the content

### Requirement: SEO analyst subagent handles SERP analysis
The seoAnalyst subagent SHALL evaluate content structure, keyword usage, and competitive positioning when invoked with a SERP analysis request.

#### Scenario: Analyze SERP readiness
- **WHEN** the user provides text for SERP analysis
- **THEN** the subagent returns analysis of keyword usage, content structure, and optimization suggestions

### Requirement: SEO analyst subagent handles content optimization
The seoAnalyst subagent SHALL provide actionable suggestions for improving search engine visibility when invoked with an optimization request.

#### Scenario: Optimize content for SEO
- **WHEN** the user provides text and requests optimization
- **THEN** the subagent returns optimized text with improved keyword usage, structure, and readability

### Requirement: SEO analyst subagent respects input limits
The seoAnalyst subagent SHALL reject inputs exceeding 10,000 characters with a clear error message.

#### Scenario: Reject oversized input
- **WHEN** the user provides text exceeding 10,000 characters
- **THEN** the subagent returns an error indicating the input exceeds the maximum size limit

### Requirement: SEO analyst subagent uses LLM integration
The seoAnalyst subagent SHALL use the existing ChatOpenAI integration for all SEO analysis operations, consistent with other subagents in the system.

#### Scenario: Analyze SEO via LLM
- **WHEN** the user requests any SEO analysis operation
- **THEN** the subagent invokes the LLM with an appropriate system prompt and returns the analysis result