# Design

## Context

See proposal.md - Why. `loadSystemPrompt()` in `src/memory/prompts.js` is the sole injection point for conditional directives into the orchestrator's system prompt. It already performs token replacement for `<!-- DECISION_TOOL_INSTRUCTION -->` and `<!-- SAMPLING_TOOL_INSTRUCTION -->`, gated on `config.agent.decision.baseUrl` and `config.agent.sampling` respectively. The `system-prompt` capability spec already documents these requirements.

## Goals / Non-Goals

**Goals:**
- Add a `silent` config option that gates a prompt directive suppressing orchestrator narration.
- Reuse the existing token-replacement pattern so the change is minimal and consistent.
- When silent, suppress the sampling announcement sentence while preserving memory capture.

**Non-Goals:**
- No runtime suppression logic in the orchestrator code.
- No change to subagent prompt handling.
- No change to the sampling tool's capture behavior.

## Decisions

**Decision 1: Prompt directive, not runtime suppression.**
Behavior is controlled by injecting a directive into the system prompt, matching the established decision/sampling mechanism. Runtime suppression in code would couple behavior to the model's message stream and is brittle. Alternative considered and rejected: suppressing output in `createDeepAgentsOrchestrator()`.

**Decision 2: Standalone unnumbered block, not a numbered rule.**
The directive is injected as a standalone bolded block in the Delivery subsection of `DELIVERY & OUTPUT`, near rule 3.1. A numbered rule would leave a numbering gap when `silent` is disabled. This matches the decision/sampling pattern.

**Decision 3: Silent sampling variant.**
When `silent` is true, the sampling instruction omits the "briefly tell the user when you capture a memory" sentence. Sampling still captures memories (the tool remains registered and functional) but does not announce them. When `silent` is false, the full sampling instruction is injected as today. This is implemented as a separate constant (`SILENT_SAMPLING_INSTRUCTION`) selected based on `config.agent.silent`.

**Decision 4: Config via env var for tests.**
Tests control `config.agent.silent` via the `AGENT_SILENT` env var plus `_resetConfigCache()`, following the existing pattern in `tests/unit/prompts.test.js`. The schema's `z.boolean().default(false)` ensures the default is `false` when unset.

## Risks / Trade-offs

- [Silent directive could suppress desired output] → The directive is scoped to intermediate commentary and narration; the final response is explicitly exempted ("Speak only when delivering your final response").
- [Sampling announcement loss when silent] → Intentional; memory capture is preserved, only the announcement is omitted. Documented in the spec.
- [Token left in prompt if config path changes] → The token is always replaced (with the directive or an empty string), so no token can leak into the returned prompt.
