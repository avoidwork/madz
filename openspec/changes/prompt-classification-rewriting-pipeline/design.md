## Context

The madz application currently passes raw user input directly to the agent graph via `callReactAgent()` in `src/agent/react.js`. User prompts vary widely in quality, structure, and clarity, which can lead to inconsistent agent behavior. A pre-processing pipeline that classifies and rewrites prompts would normalize input into a consistent format, improving the LLM's ability to understand and act on user requests.

The existing architecture uses LangGraph for state machines, with the agent graph receiving `HumanMessage` objects. The pipeline must integrate transparently — the graph should receive the same message format regardless of whether preprocessing occurred.

## Goals / Non-Goals

**Goals:**
- Classify user prompts into intent, domain, and complexity metadata
- Rewrite prompts into optimized, structured format using classification results
- Integrate pipeline into `callReactAgent()` before `HumanMessage` construction
- Make the pipeline toggleable via config (`agent.promptRewrite.enabled`)
- Ensure failures fall back to safe defaults without blocking the agent flow

**Non-Goals:**
- TUI-specific integration or UI feedback during classification/rewriting
- Real-time classification feedback to the user
- Caching or optimizing classification/rewriting performance
- Multi-language support beyond English
- User-configurable classification categories

## Decisions

1. **Two-stage LLM calls over single call**
   - Classification and rewriting are separate LLM calls for accuracy
   - Rationale: The issue's "Alternatives Considered" section explicitly prefers separate calls. Classification provides structured metadata that informs the rewriting prompt, leading to better results than a single combined call.
   - Trade-off: Doubles latency per user prompt. Mitigated by making the pipeline opt-in (disabled by default).

2. **Integration at `callReactAgent()` over LangGraph node**
   - Pipeline intercepts raw input in `callReactAgent()` before `HumanMessage` construction
   - Rationale: Simpler than adding a pre-built node to the LangGraph pipeline. Single integration point, transparent to graph nodes.
   - Trade-off: Less flexible for TUI-specific feedback. Could be extended later if needed.

3. **Fail-safe defaults over strict error handling**
   - Classification falls back to default metadata; rewriting falls back to original prompt
   - Rationale: Neither failure should block the agent flow. Users expect the agent to work even if preprocessing fails.
   - Trade-off: Silent degradation — users won't know preprocessing failed. Acceptable since pipeline is opt-in.

4. **Module structure: single file with submodules**
   - `src/agent/promptPipeline.js` — Main module with `classifyPrompt()`, `rewritePrompt()`, `processPrompt()`
   - `src/agent/promptPipeline/prompts.js` — Prompt templates
   - `src/agent/promptPipeline/categories.js` — Category enums and validation
   - Rationale: Keeps related code together while allowing template and category separation for configurability.

## Risks / Trade-offs

- **Latency**: Two LLM calls per prompt doubles preprocessing latency. [Mitigation] Pipeline is disabled by default; users can enable it only when needed.
- **API cost**: Classification + rewriting doubles LLM API calls per user message. [Mitigation] Opt-in feature, users control when to enable.
- **Intent alteration**: Rewriting could inadvertently change user intent. [Mitigation] Rewrite prompt template designed to preserve original meaning while optimizing structure; fallback to original prompt on failure.
- **Config schema changes**: Adding new config keys may affect existing users. [Mitigation] New keys have safe defaults; schema validation ensures backward compatibility.

## Migration Plan

No migration needed. The pipeline is disabled by default (`agent.promptRewrite.enabled: false`), so existing behavior is unchanged. Users who enable the pipeline will see the new behavior immediately — no data migration or breaking changes.

## Open Questions

- Should classification and rewriting prompt templates be stored in config.yaml or as separate files? (Current design: separate file `prompts.js` for maintainability)
- Should we add telemetry/metrics for pipeline usage (call count, latency, failure rate)? (Out of scope for v1, but should be considered for future iterations)