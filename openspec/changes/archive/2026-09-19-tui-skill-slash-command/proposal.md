## Why

The TUI skill slash-command (`/skill-name`) is broken. When a user types a skill name as a slash command, it routes through a legacy IPC dispatch path that loads the SKILL.md body and feeds it to the model as a plain chat prompt, rather than invoking the skill through the deepagents skill system.

## What Changes

- Remove the legacy skill dispatch path in `src/tui/conversationArea.js` (`_executeSkill` handler and the `subAction === "load"` dispatch branch that streams the skill body to the model via `dispatchProvider`).
- Remove the parser's skill-execution fallback in `src/tui/commandParser.js` that calls `context._executeSkill()`.
- Route `/skill-name` through the deepagents skill system: the parser returns a clean skill-invocation result, and `conversationArea.js` synthesizes the `Run the <skill> skill [args]` prompt and dispatches it through the normal chat path (`handleChat`), which routes through the deepagents orchestrator that has skills attached.
- Update `tests/unit/tui/commandParser.test.js` to remove legacy skill-execution assertions and add coverage for the new `/SKILL` shorthand behavior.

## Capabilities

### New Capabilities
- `tui-skill-invocation`: Defines how `/skill-name` slash commands invoke skills as shorthand through the deepagents skill system, rather than dumping SKILL.md bodies as chat prompts.

### Modified Capabilities
- `tui-interface`: The "TUI Command Entry" requirement changes — skill slash-commands now invoke skills through the deepagents system instead of the legacy IPC dispatch path.

## Impact

- `src/tui/conversationArea.js` — remove `_executeSkill` and the `subAction === "load"` dispatch branch; wire skill invocation through `handleChat`.
- `src/tui/commandParser.js` — replace the skill-execution fallback with a clean skill-invocation result.
- `tests/unit/tui/commandParser.test.js` — remove legacy skill-execution assertions, add coverage for the new `/SKILL` shorthand behavior.

## Non-goals

- Not changing how skills are discovered, validated, or registered (that is `skills-registry`).
- Not changing the deepagents orchestrator's skill attachment mechanism.
- Not changing the skills panel UI or `handleSelectSkill` behavior in `app.js`.
