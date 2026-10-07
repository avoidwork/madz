## Context

The `decision` tool is config-gated in `src/tools/index.js`: it registers only when `runtimeOptions.decisionConfig?.baseUrl` is truthy, where `decisionConfig` is set from `config?.agent?.decision`. The system prompt (`prompts/SYSTEM_PROMPT.md`) is loaded by `loadSystemPrompt()` in `src/memory/prompts.js`, which already imports `loadConfig()` for `cwd`. There is currently no mechanism to conditionally inject tool-specific guidance into the system prompt based on config.

## Goals / Non-Goals

**Goals:**
- When `agent.decision.baseUrl` is non-empty, the system prompt includes a concise instruction block describing the `decision` tool and when to use it.
- When `agent.decision.baseUrl` is empty/unset, the system prompt contains no reference to the tool.
- The instruction is a standalone, unnumbered block near the top of the prompt — not a numbered directive (which would leave a gap in the numbered list when disabled).
- The enable gate mirrors `buildToolConfig()`'s `decision` case exactly.

**Non-Goals:**
- No change to the `decision` tool, its registration logic, or the config schema.
- No change to how other tools are described.
- No change to sub-agent prompt files.

## Decisions

### Decision 1: Token replacement in `loadSystemPrompt()`

Use a placeholder token in `prompts/SYSTEM_PROMPT.md` and swap it in `loadSystemPrompt()`. This is the single, natural place where the prompt is assembled and where config is already available.

- **Alternative considered:** Inject via a separate prompt file. Rejected — adds indirection; a single token keeps the prompt self-contained.
- **Alternative considered:** Hardcode the instruction always. Rejected — references a tool that may not be registered, misleading the model.

### Decision 2: HTML comment as the token

Use `<!-- DECISION_TOOL_INSTRUCTION -->` as the token. It is unambiguous for a string replace, invisible if the replacement ever fails to run, and unlikely to collide with prompt prose.

### Decision 3: Enable gate mirrors the tool registration

Enabled iff `config.agent.decision.baseUrl` is truthy — the exact same condition `buildToolConfig()` uses. This keeps the prompt and the tool registration in sync.

### Decision 4: Unnumbered block, not a numbered directive

The instruction is a standalone block, not a numbered entry. A numbered directive would leave a gap in the numbered list (e.g., 40, 42) when the tool is disabled.

## Risks / Trade-offs

- **Token collision** → Use a unique HTML-comment token; verify it appears exactly once in the prompt.
- **Config absent** → `config.agent.decision` may be undefined; guard with optional chaining so the replacement never throws.
- **Replacement robustness** → Use `replaceAll()` or a global regex so the token is removed even if it appears more than once.
