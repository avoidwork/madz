# Design

## Context

See proposal.md - Why. This is a single-file prompt change to `prompts/SYSTEM_PROMPT.md`. The system prompt is loaded by `loadSystemPrompt` in `src/memory/prompts.js`, which appends context and injects tokens (e.g., `<!-- RULE_31_INSTRUCTION -->`, `<!-- DECISION_TOOL_INSTRUCTION -->`). The change adds a new numbered rule and edits two existing rules; it does not touch the loader or any token-injection logic.

## Goals / Non-Goals

- **Goals:** Add a "read the code; never infer it" directive adjacent to rule 4.2; carve code claims out of rules 3.2 and 4.3.
- **Non-Goals:** No code-level enforcement. No subagent prompt changes. No deepagents profile-block changes. No changes to `src/memory/prompts.js` or token injection.

## Decisions

- **Rule numbering: insert the new rule as `4.3` and renumber the subsequent rules.** The issue's proposed wording references rules by number (3.2, 4.3). Inserting the new rule as 4.3 keeps it adjacent to 4.2 and uses a numeric identifier, per project convention that rules are numeric. The subsequent rules (formerly 4.3–4.14) are renumbered to 4.4–4.15, and all cross-references are updated.
  - *Alternative considered:* a non-numeric sub-identifier (e.g., `4.2a`). Rejected — the user requires rules to be numeric.
- **Carve-out wording in 3.2.** Append "This does not apply to claims about code; see 4.3." to rule 3.2, matching the issue's proposed wording.
- **Adjust 4.4.** Add a clause noting that unverified assumptions about code are not permitted and are governed by 4.3, so the new rule overrides 4.4 for code claims.
- **Rule body wording.** Use the issue's proposed wording verbatim (adjusted for the concrete rule number), since it was validated by the reporter's testing.

## Risks / Trade-offs

- [Rule number `4.2a` is non-standard] → Mitigation: it is unambiguous, keeps the rule adjacent to 4.2, and avoids renumbering; the issue's proposed text uses a placeholder "4.x" that must be resolved to a concrete identifier.
- [Wording could be too prescriptive and slow the model] → Mitigation: the issue's proposed wording is deliberately scoped to code/config/schema/tool/library claims, not general behavior; it does not require reading source for non-code questions.

## Migration Plan

No runtime migration. The change is a prompt edit; it takes effect the next time `loadSystemPrompt` builds the prompt from `SYSTEM_PROMPT.md`.

## Open Questions

None.
