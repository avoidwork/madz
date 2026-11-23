# Proposal

## Why

The CLI `--message` flag is ignored. Running `node index.js --message "Run the reflection skill"` returns the default "Hello, friend. Good to see you. What's on your mind today?" greeting instead of processing the supplied message. This regressed in PR #1780 (commit 731622b) which rewrote `parseArgs()` in `index.js`. Because the cron scheduler invokes madz via `node index.js --message "..."`, all scheduled skill jobs silently stopped receiving their prompts.

## What Changes

- Restore `--message` option handling in `parseArgs()` in `index.js` so the flag form is honored.
- Read the message from the `--message` option first, then fall back to joining positional `parsed._` args, so both `node index.js "hello"` and `node index.js --message "hello"` work.
- When neither form is supplied, `message` remains `undefined` so `main()` falls back to the default greeting.
- Add a pure parsing unit test covering both invocation forms and the empty case.

## Capabilities

### New Capabilities
- `cli-message-parsing`: The CLI's handling of the message prompt — how the `--message` flag and positional arguments are parsed into the message passed to the conversation, including the fallback behavior when no message is supplied.

### Modified Capabilities
<!-- No existing capability's requirements change; this is a new capability. -->

## Impact

- `index.js` — `parseArgs()` (lines 38-63): declare `--message` as a yargs string option and read it before falling back to positional args.
- `index.js` — `main()` (line 578): unchanged; `args.message` will now be populated correctly.
- `src/scheduler/cron.js` — `buildSkillCommand()` (lines 192-195): unaffected code, but its `--message` invocations are restored to working behavior.
- New test file covering `parseArgs()`.

## Non-goals

- Not touching the message-passing pipeline (`callProvider`/`runAgent`, HumanMessage -> agent.stream), which is not broken.
- No changes to the cron scheduler's command generation logic.
- No changes to the LLM provider or agent orchestration.
