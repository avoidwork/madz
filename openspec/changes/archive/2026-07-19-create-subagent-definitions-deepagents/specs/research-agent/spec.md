## ADDED Requirements

### Requirement: Research Agent Definition
The system SHALL provide a Research agent definition for multi-step research tasks.

#### Scenario: Research agent performs multi-step research
- **WHEN** the research agent receives a research topic
- **THEN** it performs multiple search and extraction steps to gather information

#### Scenario: Research agent tracks sources
- **WHEN** the research agent gathers information
- **THEN** it tracks and cites all sources used

#### Scenario: Research agent produces reports
- **WHEN** the research agent completes its research
- **THEN** it produces a comprehensive research report with findings and sources

### Requirement: Research Agent Tool Access
The Research agent SHALL have access to webSearch, webExtract, grep, and glob tools.

#### Scenario: Research agent searches for information
- **WHEN** the research agent needs to find information
- **THEN** it can invoke the webSearch tool

#### Scenario: Research agent extracts content
- **WHEN** the research agent needs to read sources
- **THEN** it can invoke the webExtract tool

### Requirement: Research Agent Output Format
The Research agent SHALL produce structured output with findings, sources, and recommendations.

#### Scenario: Research output includes sources
- **WHEN** the research agent completes its research
- **THEN** the output includes all sources with citations

#### Scenario: Research output includes recommendations
- **WHEN** the research agent completes its research
- **THEN** the output includes actionable recommendations based on findings
