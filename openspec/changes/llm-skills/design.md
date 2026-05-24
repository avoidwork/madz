## Context

The `llm-tui-harness` project already defines a tool registry (stateless, single-action), session manager (state machine), memory system (markdown persistence), sandbox (Docker isolation), and TUI (ink-based). Adding skills introduces a new layer between session and tools: skills are composable, multi-step behavioral modules that orchestrate tools and manage their own sub-state within the session. This is a cross-cutting change touching all 5 existing capabilities.

Constraints: Must conform to existing AGENTS.md (Node.js 20+, ES modules, 100% coverage, pre-commit hooks). Skills are markdown files — no new runtime dependencies required. Must fit within existing Docker sandbox boundaries.

## Goals / Non-Goals

**Goals:**
- Provide a skill registry that loads, validates, and resolves skill definitions from markdown files
- Enable skills to invoke tools and chain multi-step operations within a session
- Surface skill execution, approval, and progress in the TUI
- Allow users to author, discover, and compose skills
- Support context-aware skill recommendation by the assistant
- Integrate skill state into the session manager's state machine
- Enforce the same security boundaries as tools (sandbox, allowlists, approval gates)

**Non-Goals:**
- A visual skill editor or IDE extension
- Skill versioning or package management (skills are plain markdown files)
- Skill sharing/registry marketplace (local file system only)
- Skill-to-skill calling (skills invoke tools, not other skills — composition is manual)
- TUI during scheduled execution (scheduled jobs run headless; results logged to memory)

## Decisions

### D1: Skill Format — Markdown with YAML frontmatter
- **Choice**: Each skill is a `.md` file with YAML frontmatter (name, description, scope, resources) and markdown body (instructions, steps, examples).
- **Rationale**: Markdown is human-readable, editable in any editor, version-controllable, and directly injectable into LLM prompts. YAML frontmatter provides structured metadata without requiring a separate JSON schema file.
- **Alternatives considered**: Pure YAML config + separate instructions file — dismissed as too fragmented. JSON + markdown — dismissed as less readable for non-technical authors.
- **Frontmatter fields**: `name` (id), `description` (human-readable), `scope` (enum: `project`, `workspace`, `global`), `resources` (array of file paths), `version` (semantic version).

### D2: Skill Discovery — Assistant-driven auto-recommendation + TUI browse command
- **Choice**: The assistant reviews available skills and recommends relevant ones based on conversation context. Users can also browse all skills with a TUI command (`/skills`).
- **Rationale**: Auto-recommendation leverages the LLM's ability to match context to skill intent without hardcoding rules. The `/skills` command gives users explicit discoverability.
- **Alternative considered**: Static skill binding (always-attached skills) — dismissed as too rigid and noise-heavy.
- **Implementation**: Skill instructions are injected into the LLM prompt as a list of available skill names and descriptions. The assistant determines relevance and recommends a skill when appropriate.

### D3: Skill Execution Model — Sequential tool orchestration with session-level sub-state
- **Choice**: A skill executes as a sequential workflow: the skill's instructions tell the assistant which tools to call, in what order, and with what conditions. The session enters a `skill_active` state and tracks skill-level progress.
- **Rationale**: Sequential execution is simple, debuggable, and maps naturally to how the assistant works (follow instructions step by step). Complex branching is handled by the assistant following skill instructions, not by a state machine.
- **Alternatives considered**: Directed graph of skill steps — dismissed as over-engineered; the LLM handles branching via instructions. Parallel skill execution — dismissed as incompatible with single-user conversational interface.

### D4: Skill Context Injection — Skill instructions injected into system prompt + skill history in conversation context
- **Choice**: When a skill is activated, its full instruction text is injected into the system message (like SOUL.md). Each step executed by the skill is logged to the conversation history (like tool invocations).
- **Rationale**: System prompt injection ensures the assistant has the skill's full context for every LLM call within the skill's scope. Conversation history gives visibility and audit trail.
- **Alternative considered**: Pre-compute a context window — dismissed because skill execution is interactive and step-by-step.

### D5: Skill Approval — Same as destructive tools; skills may set a `destructive` flag
- **Choice**: If a skill contains instructions that reference destructive tools (file delete, shell commands with side effects), the skill itself is marked `destructive: true` in its frontmatter. Approval gates at the skill level (before execution begins) and individual tool level continue to work as designed.
- **Rationale**: Skill-level approval prevents the user from starting a destructive workflow. Tool-level approval provides granular control within the workflow (e.g., approve the workflow but deny a specific file deletion inside it).
- **Alternative considered**: Approve only individual tools, not the skill — dismissed as too late (user already committed to the workflow).

### D6: Skill Scope — Three tiers: `project`, `workspace`, `global` filtered by settings.allowlist
- **Choice**: Skills have a scope level. `project` skills live in the project's `skills/` dir, `workspace` skills in a shared workspace dir, and `global` skills in a global config dir. The `settings.skills.scope` setting determines which tiers are loaded. A `settings.skills.allowlist` overrides scope selection with explicit file paths or glob patterns.
- **Rationale**: Scope provides a security boundary — project skills can reference project files, global skills cannot. Allowlist provides explicit opt-in for fine-grained control.
- **Alternatives considered**: Single directory with flat structure — dismissed as too unorganized for growing skill collections.

### D7: Scheduler — Cron expressions with in-process tick loop
- **Choice**: The scheduler uses standard 5-field cron expressions (`minute hour day-of-month month day-of-week`) and an in-process `setInterval` loop that checks every `settings.scheduler.checkInterval` milliseconds (default: 60000ms) for matching jobs. Jobs execute as background sessions with their own session ID, state, and metadata.
- **Rationale**: Cron syntax is universally understood and documented. In-process execution avoids spawning additional system daemons and keeps the scheduler within the same codebase as the TUI.
- **Alternatives considered**: Node-schedule library — dismissed as overkill for a simple list of user-defined cron entries. System `cron` or `systemd timers` — dismissed as coupling to host OS scheduling.
- **Concurrency model**: `settings.scheduler.maxConcurrent` limits how many jobs run simultaneously. Overflowing jobs are queued (default policy) or skipped (configurable). Each scheduled job runs in a background context: the scheduler resolves the skill, injects its instructions, and runs it to completion without TUI interaction.
- **Persistence**: Scheduled jobs are persisted to `.madz-scheduler.json` in the project root on every add/change/delete. The file is loaded at startup, enabling scheduler state to survive process restarts.
- **Logging**: Scheduled executions produce a structured log entry (same format as tool logs) with `scheduler: true`, `skill_id`, `cron_expression`, `scheduled_at`, and `completed_at`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Skill instructions could leak into user-visible conversation | Skill instructions are injected as system messages only, never displayed in TUI; only tool outputs and assistant responses appear in viewport |
| Malicious skill instructs assistant to perform harmful actions | Skill validation checks frontmatter structure, allowlist controls prevent loading unauthorized skills, destructive flag requires approval, sandbox containment |
| Skills grow complex and out of the assistant's context window | Skills have a max instructions line limit (`settings.skills.maxInstructions`). Longer skills should reference external resource files |
| Session state becomes too complex with skill sub-state | Skill state is a simple string (`idle`, `active`, `paused`, `completed`, `failed`) scoped under the session's skill state. No deep nesting |
| Auto-recommendation produces false positives | Skill recommendations are suggestions only — assistant must recommend explicitly and user can override with `/skill-off` or proceed without skills |
| Skill resource paths could escape mounted directory | Resource paths in skill frontmatter are validated to resolve within the sandbox's mounted directories (same validation as tool file paths) |
| Multiple skills active simultaneously causes context collision | Only one skill is active per session. The assistant may use multiple skills sequentially, but only one skill's instructions are injected at a time |
| Scheduled skill runs conflict with active user session | Scheduler runs in a separate background context; if the user is active, scheduled jobs are queued with a configurable policy (queue, skip, or abort) |
| Cron syntax errors cause scheduler to fail silently | Scheduler validates cron expressions at load time; invalid expressions log an error and skip the entry; valid expressions are checked before each tick |
| Long-running scheduled skills consume resources indefinitely | Scheduler enforces `maxDurationPerSkill` and `maxConcurrent` limits; over-long executions are terminated and logged |
