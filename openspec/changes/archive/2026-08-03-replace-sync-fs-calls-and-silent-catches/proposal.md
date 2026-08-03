## Why

The src/ audit (issue #683) identified two categories of violations against AGENTS.md §1.1: synchronous fs operations in async contexts that block the event loop, and bare silent catch blocks that swallow errors without logging. Both patterns degrade reliability and make debugging difficult.

## What Changes

- Convert synchronous fs calls (`readFileSync`, `writeFileSync`, `readdirSync`, `statSync`, `existsSync`, `mkdirSync`, `unlinkSync`) to async counterparts (`readFile`, `writeFile`, `readdir`, `stat`, `access`, `mkdir`, `unlink`) from `node:fs/promises` in all files called from async contexts
- Replace bare `catch {}` blocks with proper error handling using the existing `logger` singleton — `logger.debug()` for expected/non-critical failures, `logger.error()` for unexpected/critical failures
- Preserve module-level sync fs calls in `config/loader.js` and `logger.js` where they are used during synchronous initialization

## Capabilities

### New Capabilities
- `async-fs`: Requirement that all fs operations in async contexts use `node:fs/promises` instead of blocking `node:fs`
- `error-logging`: Requirement that all catch blocks log errors via the structured logger or re-throw — no silent catches

### Modified Capabilities
- None — no existing spec-level behavior changes, only implementation improvements

## Impact

- **Affected files**: `src/memory/context.js`, `src/memory/prompts.js`, `src/skills/registry.js`, `src/memory/reader.js`, `src/memory/writer.js`, `src/session/loader.js`, `src/memory/profile.js`, `src/sandbox/runner.js`, `src/skills/discoverer.js`, `src/memory/retention.js`, `src/memory/expireEphemeral.js`, `src/scheduler/scheduler.js`, `src/scheduler/cron.js`, `src/agent/agents/coding.js`, `src/agent/agents/debug.js`, `src/agent/agents/documentation.js`, `src/agent/agents/code-review.js`, `src/agent/agents/search.js`, `src/agent/agents/security-audit.js`, `src/agent/agents/performance.js`, `src/agent/agents/testing.js`, `src/agent/agents/research.js`, `src/tui/contextTokens.js`, `src/tui/statusBar.js`, `src/workspace/loadAgents.js`
- **APIs**: No breaking changes — function signatures and return types remain identical
- **Dependencies**: No new dependencies — uses existing `node:fs/promises` and `src/logger.js`
- **Tests**: Existing tests must continue to pass; some tests may need adjustment if they mock sync fs calls

## Non-goals

- Converting module-level sync fs calls in `config/loader.js` and `logger.js` (these are synchronous initialization)
- Adding new error handling frameworks or libraries
- Changing the behavior of error recovery — only adding logging, not changing what gets caught
