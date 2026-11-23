# Design

## Context

See proposal.md - Why. `parseArgs()` in `index.js` (lines 38-63) reads the message only from positional args via `parsed._.map(String).join(" ").trim()`. It does not declare `--message` as a yargs option, so when invoked as `node index.js --message "..."`, yargs stores the value in `parsed.message` and leaves `parsed._` empty, yielding `message: undefined`. `main()` (line 578) then falls back to `"Hello"`.

## Goals / Non-Goals

**Goals:**
- Restore `--message` option handling so the flag form is honored.
- Preserve positional-arg support as a fallback.
- Keep the message-passing pipeline untouched.

**Non-Goals:**
- No changes to `callProvider`, `runAgent`, or the HumanMessage -> agent.stream pipeline.
- No changes to cron command generation in `src/scheduler/cron.js`.

## Decisions

**Decision: Declare `--message` as a yargs string option and read it before positional args.**
Add `.option("message", { type: "string", description: "Message to process" })` to the yargs chain, then compute `const message = parsed.message || parsed._.map(String).join(" ").trim()`. This makes yargs capture `--message "..."` into `parsed.message` and keeps positional-arg joining as a fallback.

- **Alternative considered:** Read `parsed.message` without declaring the option. Rejected because yargs auto-detection of an undeclared option is implicit and fragile; declaring it makes the contract explicit and self-documenting.
- **Alternative considered:** Only support the flag form. Rejected because the positional form is a documented, supported invocation and must keep working.

**Decision: Treat empty/whitespace-only message as undefined.**
The existing `message || undefined` guard is retained so an empty message falls back to the default greeting, matching current behavior.

## Risks / Trade-offs

- [Regression in positional parsing] → The fallback `parsed._.map(String).join(" ").trim()` is preserved unchanged, so positional behavior is identical.
- [Cron jobs still broken] → The fix restores `--message` handling that `buildSkillCommand()` relies on; existing cron tests asserting the command string remain green.

## Migration Plan

No migration required. The fix is a localized change to `parseArgs()` plus a new unit test.

## Open Questions

None.
