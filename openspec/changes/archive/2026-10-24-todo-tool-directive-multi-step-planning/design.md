## Context

The agent's system prompt (`prompts/SYSTEM_PROMPT.md`) is loaded by `src/memory/prompts.js` (`loadSystemPrompt`), which reads the file, strips YAML frontmatter, injects the decision-tool instruction at the `<!-- DECISION_TOOL_INSTRUCTION -->` token, and appends memory context. The `todo` tool is already registered (`src/tools/todo/index.js`) and available to the orchestrator (`src/tools/index.js`), with actions `create`, `update`, `complete`, `delete`, `list`, and `clear`. The `clear` action requires `confirm: true`.

The prompt currently has no directive telling the agent to use the `todo` tool for planning. This change adds that directive as a plain-text addition to the prompt file — no loader or tool changes are required.

## Goals / Non-Goals

**Goals:**
- Add a directive to `prompts/SYSTEM_PROMPT.md` instructing the agent to use the `todo` tool for planning multi-step work and chained skills execution.
- Specify the lifecycle semantics: clear on new work, append on chained work, clear on completion.
- Add a unit test asserting the directive is present in the loaded system prompt.

**Non-Goals:**
- Changing the `todo` tool's implementation, schema, or registration.
- Changing the prompt-loading logic in `src/memory/prompts.js`.
- Adding any new tool or capability.

## Decisions

### Decision: Place the directive as a numbered rule under `#### Tool Call Discipline`

The existing prompt uses numbered rules (1–44) under `#### Tool Call Discipline`. The directive is a standing operational instruction, so it fits naturally as rule 45. This keeps it consistent with the surrounding numbered rules.

**Alternative considered:** A standalone unnumbered block like the decision-tool instruction. Rejected because the decision-tool instruction is a *conditional* injection (only present when `agent.decision.baseUrl` is set), whereas the todo directive is a standing instruction that should always be present.

### Decision: The directive must match the `todo` tool's actual API

The `clear` action requires `confirm: true` (see `src/tools/todo/index.js`). The directive must instruct the agent to pass `confirm: true` when clearing, or the clear will fail. This is verified against the tool's schema.

### Decision: Test asserts on a stable substring of the directive

The unit test in `tests/unit/prompts.test.js` writes a `SYSTEM_PROMPT.md` fixture, calls `loadSystemPrompt`, and asserts the directive substring is present. The assertion targets a stable phrase (e.g., "use the `todo` tool") that won't be affected by surrounding prompt changes.

## Risks / Trade-offs

- **Directive wording drift from tool API** → The directive is verified against `src/tools/todo/index.js`; the `clear` action's `confirm: true` requirement is explicitly called out.
- **Numbered rule collision** → Rule 45 is the next available number after 44; if the prompt grows, the number may need renumbering, but this is a low-risk, cosmetic concern.

## Migration Plan

No migration required. This is a prompt-file change plus a test addition. The change ships with the feature branch.

## Open Questions

None.
