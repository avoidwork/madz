## Context

The TUI (`src/tui/`) handles user input through a `CommandParser` (`commandParser.js`) that parses `/command` syntax. When a user types `/skill-name`, the parser's skill fallback (lines 178-188) checks `context._skillList` and calls `context._executeSkill()`. This `_executeSkill` handler (in `conversationArea.js`, lines 194-213) loads the SKILL.md body via `registry.getSkillBody()` and returns `{ action: "skill", subAction: "load", skillBody }`. The `handleCommand` skill branch (lines 236-377) then feeds that body to the model as a plain chat prompt via `dispatchProvider()`.

This is the legacy IPC dispatch path. The deepagents orchestrator (`src/agent/deepAgents.js`) already has skills attached to it (`skills: skillPaths`), so skills should be invoked by sending the natural-language prompt `Run the <skill> skill [args]` through the normal chat path — the orchestrator's skill system picks it up and invokes the skill properly.

## Goals / Non-Goals

**Goals:**
- Remove the legacy IPC skill dispatch path (`_executeSkill` and the `subAction === "load"` branch).
- Make `/skill-name` invoke the skill as shorthand through the deepagents skill system.
- Update tests to cover the new `/SKILL` shorthand behavior.

**Non-Goals:**
- Not changing skill discovery, validation, or registration (`skills-registry`).
- Not changing the deepagents orchestrator's skill attachment mechanism.
- Not changing the skills panel UI or `handleSelectSkill` in `app.js`.

## Decisions

### Decision 1: Route `/SKILL` through the normal chat path instead of a dedicated dispatch branch

**Choice:** The parser returns a clean `{ action: "skill", subAction: "invoke", name, args }` result. `conversationArea.js` synthesizes the prompt `Run the <skill> skill [args]` and dispatches it through `handleChat()`, which already routes through `dispatchProvider` → deepagents orchestrator (which has skills attached).

**Why:** The deepagents orchestrator is the canonical skill invocation mechanism. Sending the natural-language prompt through the normal chat path lets the orchestrator's skill system resolve and invoke the skill, rather than the TUI manually loading SKILL.md bodies and dumping them as prompts. This is exactly how the skills panel already works (`handleSelectSkill` sets `pendingInput` to `Run the <skill> skill`).

**Alternatives considered:**
- Keep the legacy path but fix the status bar — rejected because it preserves the broken "dump SKILL.md as chat prompt" behavior.
- Add a dedicated `dispatchSkill` path that calls the orchestrator directly — rejected because it duplicates the chat path and bypasses the normal streaming/context handling.

### Decision 2: Synthesize the prompt in `conversationArea.js` and reuse `handleChat`

**Choice:** When the parser returns a skill-invoke result, `handleCommand` builds `Run the <skill> skill [args]` and calls `handleChat(prompt)`.

**Why:** `handleChat` already handles streaming, context updates, session persistence, and abort handling. Reusing it avoids duplicating ~150 lines of streaming logic and keeps skill execution consistent with normal chat.

**Alternatives considered:**
- Keep the `subAction === "load"` branch but change what it dispatches — rejected because it keeps a parallel streaming path that duplicates `handleChat`.

## Risks / Trade-offs

- **[Skill invocation depends on the orchestrator resolving the prompt]** → Mitigation: the prompt format `Run the <skill> skill` is already used by the skills panel and scheduler, so the orchestrator already handles it.
- **[Removing `_executeSkill` may break callers]** → Mitigation: `_executeSkill` is only referenced by the parser fallback and the `handleCommand` skill branch, both of which are being removed together. Verified via grep.
