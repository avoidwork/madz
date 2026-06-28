## Context

The React agent (`src/agent/react.js`) and context compaction tool (`src/tools/compact_context.js`) have several issues that affect reliability and maintainability:

1. **Regex false positive**: `CONTEXT_LENGTH_PATTERN_2` in `compact_context.js` uses `/limit[:\s]*(\d+)/i` which matches any error containing "limit: 1234", including rate limit errors like "rate limit: 429". This triggers unnecessary context compaction attempts.

2. **Dead code**: `agent.stepTimeout = timeout` is assigned on the compiled graph but LangGraph's `streamEvents` does not read this property.

3. **Redundant parameter**: `recursionLimit` is passed to both `createReactAgentGraph` (construction) and `streamEvents` (invocation). LangGraph uses the invocation-time value, making the construction-time value redundant.

4. **Missing documentation**: `turnHashWindow` and `turnBufferMax` options lack JSDoc documentation.

5. **Test gaps**: No tests for cache hit path, `streamEvents` version parameter, `isContextLengthError` false positive detection, `recursionLimit` in `streamEvents` options, or `agent.stepTimeout` removal.

## Goals / Non-Goals

**Goals:**
- Narrow `CONTEXT_LENGTH_PATTERN_2` regex to only match context length errors
- Remove dead `agent.stepTimeout` code
- Remove redundant `recursionLimit` from construction time
- Add JSDoc for `turnHashWindow` and `turnBufferMax`
- Add comprehensive test coverage for previously uncovered paths

**Non-Goals:**
- Refactoring the overall React agent architecture
- Changing LangGraph integration patterns
- Adding new capabilities or features
- Modifying the compaction retry loop logic

## Decisions

### 1. Regex Pattern for Context Length Detection

**Decision:** Use `/context.*limit[:\s]*(\d+)/i` pattern instead of the original `/limit[:\s]*(\d+)/i`.

**Rationale:** This pattern requires "context" to appear before "limit" in the error message, which effectively filters out rate limit errors while still matching context length errors from most LLM providers (e.g., "context length limit: 4096 tokens", "context limit exceeded: 8192").

**Alternatives considered:**
- `/limit[:\s]*(\d+).*tokens/i` — Requires "tokens" after the number. More restrictive, may miss some providers that don't include "tokens" in their error messages.
- `/context.*(limit|exceeded)/i` — Matches any context-related error with "limit" or "exceeded". Less precise, may still match non-context-length errors.
- Whitelist of known error patterns — Most accurate but requires maintenance as new providers emerge.

**Chosen approach:** The `/context.*limit[:\s]*(\d+)/i` pattern provides a good balance of specificity and flexibility. It matches the most common error message formats while excluding rate limit errors.

### 2. Removing `agent.stepTimeout`

**Decision:** Remove the `agent.stepTimeout = timeout` assignment entirely.

**Rationale:** Grep confirms this property is never read anywhere in the codebase. LangGraph's `streamEvents` does not natively read this property. If timeout handling is needed, it should be done through LangGraph's documented mechanisms.

**Verification needed:** Confirm LangGraph source code does not read `agent.stepTimeout` internally. If it does, the property should be documented rather than removed.

### 3. Removing Redundant `recursionLimit`

**Decision:** Remove `recursionLimit` from `createReactAgentGraph` call, keep only in `streamEvents` options.

**Rationale:** LangGraph uses the invocation-time value passed to `streamEvents`, making the construction-time value redundant. Passing it at both places creates confusion about which value is actually used.

**Alternatives considered:**
- Keep both values but add a comment explaining the redundancy — Less clean, doesn't solve the confusion.
- Pass `recursionLimit` only at construction time — Would require LangGraph to read it from the graph state, which it doesn't do.

### 4. JSDoc Documentation

**Decision:** Add `@param` tags for `turnHashWindow` and `turnBufferMax` in the `callReactAgent` JSDoc.

**Rationale:** These options are read from the `options` parameter but lack documentation, making it difficult for developers to understand their purpose and default values.

## Risks / Trade-offs

### Risk: Regex pattern may miss some context length error formats
**Mitigation:** The pattern `/context.*limit[:\s]*(\d+)/i` matches the most common error message formats. If new providers use different formats, the pattern can be updated. Tests will verify the pattern against known error messages.

### Risk: `agent.stepTimeout` may be read by LangGraph internally
**Mitigation:** Verify LangGraph source code before removing. If the property is read internally, document it rather than removing it.

### Risk: Removing `recursionLimit` from construction may affect edge cases
**Mitigation:** Verify all code paths that call `createReactAgentGraph` to ensure they also pass `recursionLimit` to `streamEvents`. The construction-time value is never used by LangGraph, so removal should be safe.

## Migration Plan

This is a bug fix with no migration required:
1. Implement the changes on the feature branch
2. Run tests to verify no regressions
3. Run lint and coverage checks
4. Create PR targeting `main`
5. After merge, the changes take effect immediately

## Open Questions

- Does LangGraph's `streamEvents` internally read `agent.stepTimeout`? (Unconfirmed — needs verification against LangGraph source)
- Are there any LLM providers that use context length error messages that don't include the word "context"? (Needs investigation against actual error messages from providers)