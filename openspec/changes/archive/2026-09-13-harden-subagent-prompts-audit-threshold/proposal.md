## Why

The 12 subagent prompt templates in `prompts/` fail the audit-sys-prompt 7-criteria threshold (weighted score ≥ 4.2 with no single criterion ≤ 3.0). The orchestrator prompt (`prompts/SYSTEM_PROMPT.md`) passes at 4.85, but all 12 subagent prompts score ~3.75–3.85. They fail on the same three structural gaps: no explicit audience/success metrics (role_clarity capped at 4), no knowledge cutoff or degradation rules (constraints capped at 4), and no proactive clarification/error-fallback behavior (robustness capped at 3.0 — the binding constraint). Three prompts additionally describe capabilities in prose rather than tool names, dropping harness_integration to 3.0.

## What Changes

- Add an explicit **Audience** line and a **Success** completion definition to the ROLE section of all 12 subagent prompts.
- Add a **knowledge-cutoff** line and **graceful-degradation** rules to the RULES section of all 12 subagent prompts.
- Add a **"when ambiguous, ask"** clarification rule and an **error-fallback** behavior rule to the RULES section of all 12 subagent prompts.
- Convert the prose CAPABILITIES in `SEO_ANALYST`, `TEXT_EDITOR`, and `TRANSLATOR` to explicit tool-call syntax.
- No code changes. The fix is purely additive to the 12 subagent prompt templates in `prompts/`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `subagent-definitions`: The "Subagent System Prompt" requirement is extended so each subagent system prompt SHALL include an explicit audience, a success definition, a knowledge cutoff with graceful-degradation rules, and proactive clarification/error-fallback behavior. This is a spec-level change to the structure of subagent system prompts.

## Impact

- **Files modified:** 12 prompt templates in `prompts/` (CODE_REVIEW, CODING, DEBUG, DOCUMENTATION, PERFORMANCE, RESEARCH, SEARCH, SECURITY_AUDIT, SEO_ANALYST, TESTING, TEXT_EDITOR, TRANSLATOR).
- **No code changes:** `src/memory/prompts.js` only loads `SYSTEM_PROMPT.md` at runtime; the subagent templates are consumed by the subagent dispatch system.
- **No new dependencies:** This is a documentation/prompt change.
- **Docs:** `docs/OVERVIEW.md:465` documents the unified subagent prompt structure and should be updated if the structure changes.

## Non-goals

- Modifying `prompts/SYSTEM_PROMPT.md` (already passes at 4.85).
- Any code changes to `src/` or `tests/`.
- Raising or changing the audit threshold.
- Adding new npm packages or system dependencies.
