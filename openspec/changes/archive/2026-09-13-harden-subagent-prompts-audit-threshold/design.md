## Context

The `prompts/` directory contains 13 prompt templates: one orchestrator prompt (`SYSTEM_PROMPT.md`) and 12 subagent prompts (CODE_REVIEW, CODING, DEBUG, DOCUMENTATION, PERFORMANCE, RESEARCH, SEARCH, SECURITY_AUDIT, SEO_ANALYST, TESTING, TEXT_EDITOR, TRANSLATOR). All 12 subagent prompts share a unified structure: ROLE, PERSONALITY, CAPABILITIES, RULES, OUTPUT FORMAT, SAFETY, NOTE.

The audit-sys-prompt 7-criteria framework scores each prompt on role_clarity (0.18), constraints (0.15), output_format (0.15), safety_compliance (0.17), robustness (0.15), tone_consistency (0.10), and harness_integration (0.10). The pass threshold is a weighted score ≥ 4.2 with no single criterion ≤ 3.0.

`SYSTEM_PROMPT.md` passes at 4.85. All 12 subagent prompts score ~3.75–3.85. The audit findings identify three shared structural gaps and one secondary gap:
1. No explicit audience or success metrics → role_clarity capped at 4.
2. No knowledge cutoff or degradation rules → constraints capped at 4.
3. No proactive clarification / error-fallback behavior → robustness capped at 3.0 (the binding constraint).
4. SEO_ANALYST, TEXT_EDITOR, TRANSLATOR describe capabilities in prose rather than tool names → harness_integration drops to 3.0.

## Goals / Non-Goals

**Goals:**
- Lift all 12 subagent prompts above the audit threshold (weighted ≥ 4.2, no criterion ≤ 3.0).
- Add three shared structural blocks (audience/success metrics, knowledge cutoff/degradation, clarification/error-fallback) to all 12 prompts.
- Convert the prose CAPABILITIES in SEO_ANALYST, TEXT_EDITOR, and TRANSLATOR to explicit tool-call syntax.
- Keep the fix purely additive and confined to the `prompts/` directory.

**Non-Goals:**
- Modifying `SYSTEM_PROMPT.md` (already passes).
- Any code changes to `src/` or `tests/`.
- Raising or changing the audit threshold.
- Adding new npm packages or system dependencies.

## Decisions

**Decision 1: Shared template blocks, not per-prompt rewrites.**
The three gaps are structural, not content-specific. Rather than rewriting each prompt individually (which duplicates the same fix 12 times and risks drift), we add three shared blocks with consistent phrasing, tailored minimally to each prompt's domain. This mirrors how `SYSTEM_PROMPT.md` already expresses audience, knowledge cutoff, and clarification rules.

- **Audience & Success Metrics:** Add an `**Audience:**` line and a `**Success:**` completion definition to the ROLE section. This lifts role_clarity from 4 to 5 by providing an explicit target audience and a bounded success definition.
- **Knowledge Cutoff & Degradation:** Add a knowledge-cutoff line and graceful-degradation rules to the RULES section (e.g., "If uncertain, state the assumption and ask; never fabricate"). This lifts constraints from 4 to 5.
- **Clarification & Error Fallback:** Add a "when ambiguous, ask" rule and an error-fallback behavior (report rather than loop on tool failures) to the RULES section. This lifts robustness from 3.0 to 4+.

**Decision 2: Convert prose capabilities to tool-call syntax.**
For SEO_ANALYST, TEXT_EDITOR, and TRANSLATOR, replace prose capability descriptions with explicit tool identifiers (e.g., `searchWeb`, `extractWeb`). This lifts harness_integration from 3.0 to 4+.

**Decision 3: No code wiring changes.**
`src/memory/prompts.js` only loads `SYSTEM_PROMPT.md` at runtime. The subagent templates are consumed by the subagent dispatch system, not by this module. Changes are confined to the `prompts/` directory.

## Risks / Trade-offs

- **Prompt drift** → Mitigation: use consistent shared block phrasing across all 12 prompts, with only domain-specific tailoring in the audience/success lines.
- **Over-length prompts** → Mitigation: keep each added block to 1–3 lines; the additions are structural and concise.
- **Audit regression** → Mitigation: re-run the audit-sys-prompt framework against all 12 prompts after the change and confirm no prompt regresses below its current score and each clears the threshold.

## Migration Plan

No migration needed — this is a documentation/prompt change. The change is additive to the 12 subagent prompt templates.

## Open Questions

None.
