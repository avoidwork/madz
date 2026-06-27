---
name: audit-code
description: Audits each directory in ./src for bugs, security vulnerabilities, and performance issues sequentially. Generates one consolidated issue per directory via /create-issue.
license: MIT
compatibility: Node.js project with ./src directory structure
metadata:
  version: "2.2.0"
  phase-mode: "sequential"
  target: "./src"
---

# Audit Code

Audit the `./src` directory tree for bugs, security vulnerabilities, and performance issues. Execute **sequentially** — process one directory at a time, saving state between steps.

## State Management

Use a state file to persist progress across responses. The state file is cleaned at the start of a new audit and at the end when all phases are complete.

### State File Location

Use the path provided in the delegation context. If no path is provided, default to `memory/audit-state.md`.

### State File Format

```markdown
# Audit State

## Phase Queue
- [x] ./src
- [ ] ./src/agent
- [ ] ./src/utils

## Current Phase
./src/agent

## Completed
- ./src

## Findings
[Current phase findings stored here as markdown table]
```

### State Lifecycle

1. **Start of audit** — Delete any existing state file at the configured path. Begin fresh.
2. **After each directory** — Save the current state (completed directories, current phase, findings).
3. **On resume** — Read the state file to determine where to pick up.
4. **End of audit** — Delete the state file once all phases are complete.

---

## Phase Protocol

### Phase 0: Discovery

1. **Clean state.** Delete any existing state file at the configured path: `rm -f <state-file-path>`
2. List all directories to audit: `./src` itself, plus all immediate subdirectories of `./src` (exclude `node_modules`, `.git`, `__tests__`, `.next`, `dist`, `build`).
3. Sort them alphabetically.
4. Build the phase queue: `[./src, subdir1, subdir2, ...]` in alphabetical order.
5. Save the phase queue to the state file.
6. **Proceed** to sequential processing immediately.

### Sequential Directory Processing

Process directories one at a time in alphabetical order.

#### Directory Scan Execution

For each directory in the queue:

1. **Update state.** Mark the current directory as `Current Phase` in the state file.
2. **Enumerate files.** List all files in the target directory. Recurse into subdirectories, excluding: `node_modules`, `.git`, `__tests__`, `.next`, `dist`, `build`.
3. **Audit each file.** For each file, check for:
   - **Bugs:** Null dereferences, unhandled promises, missing error handling, race conditions, stale closures
   - **Security:** XSS vectors, SQL injection, hardcoded secrets, unsafe deserialization, missing auth checks
   - **Performance:** N+1 queries, unbounded loops, missing memoization, large bundle imports, synchronous file I/O
4. **Classify severity.**
   - **Critical:** Data breach risk, production crash, data loss, authentication bypass
   - **High:** Functional bug affecting users, XSS, SQL injection, memory leak
   - **Medium:** Performance degradation, missing error handling, code smell
   - **Low:** Minor optimization, style inconsistency, TODO items
5. **Create Issue.** Create a GitHub issue via `/create-issue` with:
   - **Title:** `Audit: [directory_path]`
   - **Description:** Summary of findings, categorized by severity
   - **Labels:** `audit`, `code-review`
6. **Update Issue Body.** Append a structured audit table to the issue body:
   | File | Type | Severity | Summary |
   |------|------|----------|---------|
   | `auth.ts` | security | critical | Hardcoded API key in source |
   | `user.ts` | bug | high | Unhandled promise rejection |
7. **Update State.** Mark the directory as completed in the state file and append findings to the `## Findings` section.
8. **Report Output.** Use the standard Output Format below.
9. **Advance.** Move to the next directory in the queue. If none remain, delete the state file and report completion.

---

## Execution Rules

1. **SEQUENTIAL PROCESSING.** Process directories one at a time in alphabetical order.
2. **NO PARALLELISM.** Do not spawn subagents or process multiple directories concurrently.
3. **STATE PERSISTENCE.** Always save state after processing each directory. Always read state before starting a new directory.
4. **ONE ISSUE PER DIRECTORY.** Do not combine multiple directories into a single issue.
5. **STOP CONDITION.** Terminate when all directories in the phase queue have been processed.

## Output Format

Each phase response must include:

```
## Audit: [directory path]
- **Status:** completed | blocked | no-issues
- **Files Audited:** [count]
- **Issues Found:** [count] (critical: N, high: N, medium: N, low: N)
- **Details:**
  - [key-finding-1]
  - [key-finding-2]
- **Action Items:** [issue created with ID or "No issues detected"]
- **Next Steps:** [next directory name or "All phases complete"]
```