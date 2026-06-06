## Context

Current skill discovery (`src/registry/discoverer.js:23-24`) looks for `skill.yaml`/`skill.json` files — a custom format not recognized by any Agent Skills compatible agent (Claude Code, VS Code, Cursor, Gemini CLI, OpenAI Codex, etc.). The standard format is `SKILL.md` with YAML frontmatter. This incompatibility blocks ecosystem skill interoperability. Additionally, activation is clunky: the model must call `skills_list`/`skill_view` LangChain tools rather than progressively loading SKILL.md via natural file-read. The sandbox runner uses `fork()` which only works for Node.js scripts, preventing execution of `.py`, `.sh`, `.rb` scripts bundled in skills.

## Goals / Non-Goals

**Goals:**
- Parse `SKILL.md` YAML frontmatter as the primary metadata source
- Enforce spec field constraints (name, description, compatibility)
- Implement progressive disclosure: catalog at startup, SKILL.md body on activation via model's file-read
- Replace `fork` with generic `spawn` to support non-Node scripts (.py, .sh, .rb, .ts)
- Add cross-client directory scanning (`.agents/skills/`, project-level, user-level)
- Drop `inputSchema`/`outputSchema` as they are not part of the standard
- Maintain backward compatibility with existing sandbox capabilities (path resolution, URL filtering, env injection, timeout handling)

**Non-Goals:**
- Adding script dependency management (e.g., `uv run`, `npx`) — the agent invokes scripts, not the harness
- Adding eval/integration test framework for skills
- Changing the registry class interface or existing unit test contracts
- Implementing a skills marketplace or remote registry
- Handling skill versioning/updates (agents handle this in their own ecosystems)

## Decisions

### Decision 1: SKILL.md over skill.yaml
**Choice**: Parse `SKILL.md` frontmatter exclusively (remove skill.yaml/skill.json support).
**Rationale**: The entire Agent Skills ecosystem uses `SKILL.md`. Keeping a parallel format adds maintenance burden with zero interoperability benefit.
**Alternatives considered**: Keep both formats and deprecate skill.yaml. Rejected: adds complexity, delays adoption, dual-format validation is error-prone.

### Decision 2: Model-driven activation over LangChain tools
**Choice**: Replace `skills_list`/`skill_view` tools with a system-prompt skill catalog. The model reads SKILL.md via its built-in file-read tool.
**Rationale**: Progressive disclosure is the spec's core principle. Tool-based activation forces two turns (list → view) and leaks the activation mechanism to the model.
**Alternatives considered**: Keep tools but add catalog as supplement. Rejected: tools are the wrong abstraction for skill activation — the agent knows its own file-read tools best.

### Decision 3: spawn over fork
**Choice**: Use `node:child_process.spawn` with interpreter detection by extension/shebang.
**Rationale**: `fork` only supports Node.js modules. The spec supports Python, Bash, Deno, Go, Ruby scripts bundled in skills.
**Alternatives considered**: Keep fork for .js and spawn for others. Rejected: adds branching complexity and memory management differences. Uniform spawn is simpler.

### Decision 4: Lenient validation on load
**Choice**: Warn on constraint violations (name too long, non-matching directory) but still load the skill. Skip only if YAML is completely unparseable or description is empty.
**Rationale**: The spec explicitly says "Lenient validation" for cross-client compatibility — skills authored for other clients may have minor violations.
**Alternatives considered**: Strict (skip any violation). Rejected: blocks interoperability with third-party skills.

### Decision 5: `.agents/skills/` as primary scan path
**Choice**: Add `.agents/skills/` to the default scan scopes alongside `skills/`.
**Rationale**: `.agents/skills/` is the cross-client interoperability convention. `skills/` is kept as project-local.
**Alternatives considered**: Replace `skills/` with `.agents/skills/`. Rejected: existing projects use `skills/`; breaking that would be confusing.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Existing TUI skills panel may reference `skills_list`/`skill_view` tools | Update TUI to load catalog from registry directly — or keep a stripped-down `skills_list` tool that returns the catalog (non-LangChain wrapper) |
| `spawn` has different memory/resource semantics than `fork` | Add explicit `--max-old-space-size` for `.js` scripts; document memory limits in config |
| Progressive disclosure shifts activation logic into the system prompt | System prompt already handles skill discovery; this is a net simplification |
| Cross-client scanning may pick up unexpected skills from user profile | Trust gating: project-level skills require explicit trust flag; user-level always scanned |
| Removing `inputSchema`/`outputSchema` breaks backward compatibility | No skills in the repo currently define these schemas; safe removal with zero migration risk |

## Migration Plan

1. Implement all changes on this branch
2. Run full test suite — confirm 100% coverage
3. If any existing skills directory with `skill.yaml` files exists, convert to `SKILL.md` format
4. Update config.yaml `sandbox.paths` default to include `.agents/skills/`
5. Deploy and verify TUI skills panel updates
