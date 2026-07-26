## Context

The project uses LangChain's `@langchain/core/tools` for all assistant tools. Tools are created via factory functions and exported from `src/tools/index.js` as part of `TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, and `TOOLS`. The `shell` tool exports `shell` (the LangChain tool), `processTool`, `executeShellImpl`, `executeForeground`, `executeBackground`, `processTracker`, and `trackProcess`.

The `process` tool (`processTool` from shell.js, registered separately in index.js with permissions `["filesystem:exec", "process:spawn"]`) handles background process management (list, kill, log, wait, write, pause, resume) while the shell tool handled foreground command execution. They overlap in capabilities.

Deep agents are configured with `getAgentClassifications()` in `src/agent/deepAgents.js`, which maps agent names to tool arrays. Four agents reference `shell`: debug, testing, security-audit, and performance. These agents should use `executeCode` as a replacement for foreground shell execution.

The shell.js file also supports `executeCode` shell language parsing when `type === "shell"` (a LangChain tool input type). This internal parsing logic needs to remain available even after removing the public tool.

## Goals / Non-Goals

**Goals:**
- Remove `shell` from all public registries (TOOL_PERMISSIONS, TOOL_CLASSIFICATIONS, ORCHESTRATOR_TOOLS, TOOLS) so agents no longer register it.
- Remove `shell` from deep agent tool classifications.
- Make the `shell` const private in shell.js (rename export to nothing private).
- Keep `processTool`, `executeShellImpl`, and other internal exports available for executeCode shell language support and process management.
- Update tests to reflect the removal.

**Non-Goals:**
- Do NOT delete `shell.js` — it contains critical infrastructure for the `process` tool and executeCode shell language support.
- Do NOT modify `executeCode` tool — agents still use executeCode with `type: "shell"` and LangChain handles parsing.
- Do NOT change cron scheduler shell execution — it uses its own shell invocation, not the shell tool.

## Decisions

1. **Export removal only, no file deletion.** The shell.js file contains shared infrastructure (processTracker, trackProcess) used by the process tool and executeCode shell language. Deleting it would require refactoring elsewhere.
2. **Private export via naming convention.** The `shell` const is made private by keeping the export statement but removing it from all public registries. The name change to `#shell` or removing the export entirely are alternatives — we choose to keep the import but not export.
3. **Agent tool replacement.** Debug, testing, and performance agents previously used `shell`. After removal, they rely on `executeCode` for code/command execution. The security-audit agent loses any execution capability in its tool set (it has no execution tools like executeCode), which is acceptable since security audit should be read-only.

## Risks / Trade-offs

- [Risk: Agents lose direct shell access] → **Mitigation:** Debug, testing, and performance agents can use `executeCode` with shell-compatible syntax. Security-audit agent should remain read-only by design.
- [Risk: executeCode shell language parsing breaks] → **Mitigation:** `executeShellImpl` and related functions remain exported from shell.js. The internal parsing for `type: "shell"` still works.
- [Risk: Cron scheduler depends on shell] → **Mitigation:** Cron uses `shell: true` in child_process.fork/spawn options, not the shell tool. No impact.
