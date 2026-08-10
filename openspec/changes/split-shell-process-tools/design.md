## Context

`src/tools/shell.js` (257 lines) is the largest file in the tools directory. It contains:
- Process management: `processTracker` Map, `trackProcess()`, `manageProcessImpl()`, `processTool`
- Shell execution: `executeForeground()`, `executeBackground()`, `executeShellImpl()`, `shell`

The process management code handles background process lifecycle (list, poll, log, wait, kill, write, pause, resume). The shell execution code handles foreground and background command execution. These are distinct concerns that should be in separate files.

## Goals / Non-Goals

**Goals:**
- Split shell.js into shell.js (~100 lines) and process.js (~150 lines)
- Maintain all exports via index.js
- Zero behavioral changes

**Non-Goals:**
- Adding new process actions
- Changing shell execution behavior
- Restructuring other tool files

## Decisions

1. **process.js for process management:** The process tracker, trackProcess function, manageProcessImpl, and processTool all belong in a dedicated file.

2. **shell.js keeps shell execution:** executeForeground, executeBackground, executeShellImpl, and shell remain in shell.js.

3. **Cross-import:** `executeBackground` calls `trackProcess`, so shell.js will import from process.js. This is a clean one-directional dependency (shell → process), not a cycle.

4. **No rename:** The existing filename `shell.js` is retained for the shell execution portion.

## Risks / Trade-offs

- **Cross-file import:** shell.js imports from process.js. Mitigation: this is a clean one-directional dependency.
- **Consumer updates:** Any file importing `processTracker` or `processTool` from `shell.js` needs to update its import path. Mitigation: grep the codebase for all consumers.
