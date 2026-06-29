## Why

User prompts vary widely in quality, structure, and clarity. A classification + rewriting step would improve the LLM's ability to understand and act on user input by normalizing it into a consistent, optimized format. This acts as a prompt engineering pipeline step — a pre-processing layer between raw user input and the main agent graph.

## What Changes

- Add a prompt classification module that analyzes user prompts and assigns metadata: intent (question, task, creative, analysis, other), domain (coding, writing, analysis, general, other), and complexity (simple, moderate, complex)
- Add a prompt rewriting module that takes the original prompt plus classification metadata and rewrites it into a structured, optimized format
- Integrate the pipeline into `callReactAgent()` before `HumanMessage` construction
- Gate the entire pipeline behind a config flag (`agent.promptRewrite`) so it can be toggled on/off without code changes
- Add configuration schema support for pipeline settings

## Capabilities

### New Capabilities
- `prompt-pipeline`: LLM-based prompt classification and rewriting pipeline that processes user input before it reaches the agent graph

### Modified Capabilities
<!-- None — this is a new capability, not a modification of existing spec-level behavior -->

## Impact

- `src/agent/react.js` — `callReactAgent()` integration point, modified to intercept raw input
- `src/config/loader.js` — config loading, updated to support new pipeline settings
- `src/config/schemas.js` — config schema, updated to validate new settings
- No new external dependencies — uses existing LLM calling infrastructure
- Backward compatible — pipeline is disabled by default, raw input passes through unchanged when disabled