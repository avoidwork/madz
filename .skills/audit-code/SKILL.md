---
name: audit-code
description: Audits each directory in ./src for bugs, security vulnerabilities, and performance issues. Generates one consolidated issue per directory via /create-issue.
license: BSD 3-Clause
compatibility: Node.js project with ./src directory structure
metadata:
  version: 2.3.0
  target: ./src
  agent: code-review
---

# Audit Code

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Audit the `./src` directory tree for bugs, security vulnerabilities, and performance issues. Directories are independent — each gets its own issue.

## State Management

Use a state file to persist progress across responses. The state file is cleaned at the start of a new audit and at the end when all phases are complete.

### State File Location

The state file path is provided in the chain context (the text after `/audit-code`). If no path is provided, default to an example name like `audit-state.md` — the agent decides where to place it.

To prevent collisions when multiple instances run, include a session identifier in the path:

```bash
SESSION_ID=$(head -c 8 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || echo $RANDOM$RANDOM$RANDOM)
STATE_FILE="${STATE_FILE_PATH:-audit-state-${SESSION_ID}.md}"
```

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

**Cleanup:** The state file should exist only while the audit is actively in progress. Delete it once all phases are complete. If the audit fails or is interrupted, delete the state file as part of cleanup. Do not rely on a shell `trap` — the agent must explicitly remove its work files when the task finishes or when cleaning up after a failure.

---

## Phase Protocol

### Phase 0: Discovery

1. **Derive repository info** once at the start (used for all issue operations):
   ```bash
   GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
   if echo "$GIT_REMOTE" | grep -q '^git@'; then
     REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\).git$/\1/')
   elif echo "$GIT_REMOTE" | grep -q 'github\.com'; then
     REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\).git$/\1/')
   else
     echo "ERROR: Could not parse repository from remote '$GIT_REMOTE'."
     exit 1
   fi
   echo "REPO=$REPO"
   ```

2. **Clean state.** Delete any existing state file: `rm -f "$STATE_FILE"`

3. **Enumerate directories.** List all directories to audit:
   ```bash
   # List ./src and all immediate subdirectories, excluding common patterns
   find ./src -maxdepth 1 -type d | sort
   ```

4. Sort them alphabetically (the `find | sort` above handles this).

5. Build the phase queue: `[./src, subdir1, subdir2, ...]` in alphabetical order.

6. **Save the phase queue** to the state file:
   ```bash
   cat > "$STATE_FILE" << EOF
   # Audit State

   ## Phase Queue
   - [x] ./src
   EOF
   # Append subdirectories
   find ./src -mindepth 1 -maxdepth 1 -type d | sort | while read dir; do
     echo "- [ ] $dir" >> "$STATE_FILE"
   done
   echo "" >> "$STATE_FILE"
   echo "## Current Phase" >> "$STATE_FILE"
   echo "./src" >> "$STATE_FILE"
   echo "" >> "$STATE_FILE"
   echo "## Completed" >> "$STATE_FILE"
   echo "- ./src" >> "$STATE_FILE"
   echo "" >> "$STATE_FILE"
   echo "## Findings" >> "$STATE_FILE"
   ```
6. **Proceed** to directory processing immediately.

### Directory Processing

Each directory is independent and gets its own issue, so there is no ordering dependency.

#### Directory Scan Execution

For each directory in the queue:

1. **Read state.** Read the state file to get the current phase:
   ```bash
   CURRENT_PHASE=$(grep -A1 "^## Current Phase" "$STATE_FILE" | tail -1 | tr -d ' \n')
   echo "Processing: $CURRENT_PHASE"
   ```

2. **Enumerate files.** List all files in the target directory:
   ```bash
   # Recurse into subdirectories, excluding common patterns
   find "$CURRENT_PHASE" -type f \
     ! -path '*/node_modules/*' \
     ! -path '*/.git/*' \
     ! -path '*/__tests__/*' \
     ! -path '*/.next/*' \
     ! -path '*/dist/*' \
     ! -path '*/build/*' \
     ! -name '*.test.*' \
     ! -name '*.spec.*' \
     ! -name '*.d.ts' \
     ! -name '*.js.map' \
     \( -name '*.js' -o -name '*.ts' -o -name '*.jsx' -o -name '*.tsx' \)
   ```

3. **Audit each file.** For each file, check for issues using concrete patterns:

   **Bugs** — grep for common anti-patterns:
   ```bash
   # Silent catch blocks
   grep -rn 'catch\s*(' "$file" | grep -v 'err' | grep -v 'error'
   # Unhandled promises (no .catch())
   grep -rn '\.then(' "$file" | grep -v '\.catch('
   # console.log in production code
   grep -rn 'console\.log' "$file"
   ```

    **Security** — grep for OWASP Top 10 violations (per AGENTS.md §1.2):
    ```bash
    # Hardcoded secrets — capture count only, NEVER print values to issue body
    SECRET_COUNT=$(grep -rnc 'password\s*=\s*["\x27]' "$file" 2>/dev/null | awk -F: '{s+=$NF}END{print s}')
    SECRET_COUNT=${SECRET_COUNT:-0}
    # eval() usage (forbidden per AGENTS.md §1.1)
    grep -rn 'eval(' "$file"
    # SQL injection vectors (string concatenation in queries)
    grep -rn "query\s*.*\+\s*req" "$file"
    # Missing auth middleware on routes
    # (check route definitions for missing auth guards)
    ```

    **CRITICAL:** When writing security findings to the issue body or state file, NEVER include the matched line content. Only report the pattern type and count:

    ```
    | [file] | security | critical | Potential hardcoded secret: password/api_key pattern detected (N occurrences) |
    ```

    The actual secret value must never appear in any output — it will be written to a GitHub issue via `gh issue edit`, exposed to anyone with repo access.

   **Performance** — grep for common issues:
   ```bash
   # Synchronous file I/O in async functions
   grep -rn 'readFileSync\|writeFileSync' "$file"
   # Unbounded loops
   grep -rn 'while\s*(true)' "$file"
   # Large bundle imports
   grep -rn 'import.*\*' "$file"
   ```

4. **Classify severity.** Use these concrete criteria:
   - **Critical:** Data breach risk, production crash, data loss, authentication bypass
   - **High:** Functional bug affecting users, XSS, SQL injection, memory leak
   - **Medium:** Performance degradation, missing error handling, code smell
   - **Low:** Minor optimization, style inconsistency, TODO items

   **Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to classify each finding's severity. Issue one `choice` question per finding, passing the finding as state.

   ```
   Question: "Classify the severity of this finding: [finding description]"
   Type: choice
   Options: critical, high, medium, low
   Criteria:
     critical = data breach risk, production crash, data loss, authentication bypass
     high     = functional bug affecting users, XSS, SQL injection, memory leak
     medium   = performance degradation, missing error handling, code smell
     low      = minor optimization, style inconsistency, TODO items
   Example answer: high
   ```

   Interpret the returned label directly. Fall back to the criteria above if no decision tool is available.

5. **Create Issue.** Invoke the `create-issue` skill with a synthesized description:
   ```
   create-issue Audit findings for $CURRENT_PHASE: Found N critical, N high, N medium, N low issues. See audit results below for details.
   ```

   **Capture `ISSUE_NUMBER` from the create-issue output** (the chained skill prints `ISSUE_NUMBER=<number>`):

   ```bash
   # Capture ISSUE_NUMBER from the conversation history (last occurrence wins)
   ISSUE_NUMBER=$(echo "$CONVERSATION_HISTORY" | grep -oE '^ISSUE_NUMBER=[0-9]+' | tail -1 | cut -d= -f2)
   if [ -z "$ISSUE_NUMBER" ]; then
     echo "ERROR: Could not capture ISSUE_NUMBER from create-issue output. Conversation history:"
     echo "$CONVERSATION_HISTORY" | tail -20
     exit 1
   fi
   echo "ISSUE_NUMBER=$ISSUE_NUMBER"
   ```

   **After creating the issue (or failing to), continue to Step 6.** Do not stop or wait for further input — the pipeline proceeds automatically.

6. **Update Issue Body.** Append a structured audit table to the issue. Collect findings into a temp file, then write them to the issue:

   ```bash
   AUDIT_FILE=$(mktemp)

   # Write the audit table header
   printf "| File | Type | Severity | Summary |\n|------|------|----------|---------|\n" > "$AUDIT_FILE"

   # Append each finding as a table row (populated from the audit results collected above)
   # Example: printf "| src/foo.js | bug | high | Unhandled promise rejection |\n" >> "$AUDIT_FILE"

   gh issue edit "$ISSUE_NUMBER" --body-file "$AUDIT_FILE" --repo "$REPO"

   # Verify the body was updated successfully
   VERIFY_BODY=$(gh issue view "$ISSUE_NUMBER" --json body --jq '.body' --repo "$REPO" 2>/dev/null || true)
   if ! echo "$VERIFY_BODY" | grep -q "File.*Type.*Severity.*Summary"; then
     echo "WARNING: Failed to verify audit table was written to issue #$ISSUE_NUMBER."
   else
     echo "Audit table verified on issue #$ISSUE_NUMBER."
   fi

   rm -f "$AUDIT_FILE"
   ```

7. **Update State.** Mark the directory as completed in the state file:
    ```bash
    # Use | as sed delimiter to safely handle directory paths containing /
    ESCAPED_PHASE=$(echo "$CURRENT_PHASE" | sed 's/[|&]/\\&/g')
    sed -i "s|- \[ \] $ESCAPED_PHASE|- [x] $ESCAPED_PHASE|" "$STATE_FILE"
    # Append findings
    echo "" >> "$STATE_FILE"
    echo "## Findings: $CURRENT_PHASE" >> "$STATE_FILE"
    echo "[Findings stored here]" >> "$STATE_FILE"
    ```

8. **Report Output.** Use the standard Output Format below.

9. **Advance.** Move to the next directory in the queue. If none remain, delete the state file (`rm -f "$STATE_FILE"`) and report completion.

---

## Execution Rules

1. **STATE PERSISTENCE.** Always save state after processing each directory. Always read state before starting a new directory.
2. **ONE ISSUE PER DIRECTORY.** Do not combine multiple directories into a single issue.
3. **STOP CONDITION.** Terminate when all directories in the phase queue have been processed.

## Error Handling

- **State file not found:** If the state file doesn't exist on resume, begin fresh from Phase 0.
- **Directory not found:** If a directory in the phase queue doesn't exist, skip it and log a warning.
- **gh CLI not authenticated:** Suggest running `gh auth login`.
- **Network error:** Retry once, then report the failure and skip the current directory.
- **create-issue failure:** Log the error, skip issue creation for this directory, and continue. Do not abort the audit.
- **Partial audit:** If some directories succeed and others fail, report what was accomplished. Never leave the audit half-done.
- **Rate limit:** If GitHub API returns 403 rate limit, wait 60 seconds and retry once.

## Gotchas

- **Security findings must never include raw secret values.** The audit table only reports pattern type and count — never the matched line content. Writing secrets to a GitHub issue exposes them to anyone with repo access.
- **State file cleanup is critical.** Always delete the state file at the start of a new audit and at the end when complete. Stale state files cause incorrect resume behavior.
- **`gh` CLI must be authenticated before starting.** The audit will fail silently at Step 6 if `gh` is not logged in. Run `gh auth login` first.

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