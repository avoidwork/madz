## ADDED Requirements

### Requirement: Performance Agent Definition
The system SHALL provide a Performance agent definition for performance benchmarking and optimization.

#### Scenario: Performance agent runs benchmarks
- **WHEN** the performance agent receives code to benchmark
- **THEN** it runs performance benchmarks and measures execution time

#### Scenario: Performance agent identifies bottlenecks
- **WHEN** the performance agent analyzes benchmark results
- **THEN** it identifies performance bottlenecks and slow operations

#### Scenario: Performance agent suggests optimizations
- **WHEN** the performance agent identifies bottlenecks
- **THEN** it provides optimization recommendations with expected improvements

### Requirement: Performance Agent Tool Access
The Performance agent SHALL have access to read_file, executeCode, grep, and shell tools.

#### Scenario: Performance agent reads source files
- **WHEN** the performance agent needs to understand code
- **THEN** it can invoke the read_file tool

#### Scenario: Performance agent runs benchmarks
- **WHEN** the performance agent needs to measure performance
- **THEN** it can invoke the executeCode tool to run benchmarks

### Requirement: Performance Agent Output Format
The Performance agent SHALL produce structured output with benchmark results and optimization recommendations.

#### Scenario: Performance output includes benchmark results
- **WHEN** the performance agent completes benchmarking
- **THEN** the output includes benchmark results with timing data

#### Scenario: Performance output includes recommendations
- **WHEN** the performance agent identifies bottlenecks
- **THEN** the output includes optimization recommendations with expected improvements
