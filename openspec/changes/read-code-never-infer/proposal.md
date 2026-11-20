# Proposal

## Why

The system prompt has no directive requiring the model to read the actual source before it makes claims about code, and rule 3.2 actively pushes the other way ("Do not over-verify... Answer with confidence"). This produced a confident, wrong answer with zero tool calls: asked whether the `code` tool's input schema is a zod discriminated union or a plain object, the model answered "a plain object" while `src/tools/code/code.js:15` is `z.discriminatedUnion("action", [...])`. The model reasoned from the flattened JSON schema in its tool list, not the source that produced it.

## What Changes

- Add a new rule (4.2a) in the JUDGMENT & ENGAGEMENT → Engagement section of `prompts/SYSTEM_PROMPT.md`, immediately after rule 4.2, requiring the model to open and read the actual source (naming file and line) before stating how code, a config file, a schema, a tool, or a library works, or that a file/function/setting exists.
- The rule forbids answering from memory, names, error messages, generated schemas, the tool list, or documentation — the schema visible is not the source that produced it.
- The rule requires marking statements unverified when the source cannot be read, and requires running a command or test before calling something the cause, fixed, or working, saying what was checked and what was not.
- Append to rule 3.2 a carve-out: "This does not apply to claims about code; see 4.2a."
- Adjust rule 4.3 (State your assumptions) so an unverified assumption about code is not permitted.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `system-prompt`: The `SYSTEM_PROMPT.md` SHALL include a "read the code; never infer it" directive requiring the model to open and read the actual source before making claims about code, config, schemas, tools, or libraries, and SHALL carve code claims out of the "respond when you have the answer" and "state your assumptions" rules.

## Impact

- `prompts/SYSTEM_PROMPT.md` — the only file modified. No code, no subagent prompts, no deepagents changes.

## Non-goals

- No code-level enforcement (e.g., refusing statements about unread files).
- No changes to subagent prompts (CODING.md, DEBUG.md, CODE_REVIEW.md, RESEARCH.md).
- No changes to deepagents' profile block or model-keyed registration.
