---
name: review-code
description: Audits each directory in ./src for bugs, security vulnerabilities, and performance issues using a deterministic rule catalog with fixed severities and a weighted scoring rubric. Generates one consolidated issue per directory via /create-issue.
license: BSD 3-Clause
compatibility: Node.js project with ./src directory structure
metadata:
  version: 3.0.0
  target: ./src
  agent: code-review
---

# Review Code

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Audit the `./src` directory tree for bugs, security vulnerabilities, and performance issues. Directories are independent — each gets its own issue.

The audit is **deterministic**: every finding is produced by a fixed rule from the catalog below, each rule carries a fixed severity, and overall health is a computed score. No subjective severity judgment is required.

---

## Deterministic Audit Method

### Rule Catalog

Every finding maps to exactly one rule. **Severity is a property of the rule, never a judgment call.** Do not re-grade a finding — the rule's severity is authoritative.

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret`/`access_key` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret\|access[_-]?key)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | `eval()` / `new Function()` / `__import__()` | critical | `grep -rnE 'eval\(|new Function\(|__import__\('` |
| SEC-003 | security | SQL injection (string concat in query) | high | `grep -rnE '(query\|sql)\s*.*\+\s*(req\|body\|params\|query)'` |
| SEC-004 | security | Route missing auth middleware | critical | structural check (see below) |
| SEC-005 | security | Unsafe URL scheme (`file://`, `gopher://`, `dict://`) | high | `grep -rnE '(file\|gopher\|dict)://'` |
| SEC-006 | security | Plaintext secret stored outside `process.env` | high | `grep -rnE '(password\|secret\|api[_-]?key)\s*=\s*["'"']'` |
| BUG-001 | bug | Silent catch block | medium | `grep -rnE 'catch\s*\([^)]*\)\s*\{\s*\}'` |
| BUG-002 | bug | Unhandled promise (`.then(` without `.catch(`) | high | `grep -rnE '\.then\('` minus `.catch(` |
| BUG-003 | bug | `console.log` in production code | low | `grep -rn 'console\.log'` |
| BUG-004 | bug | Mutating a list while iterating | medium | structural check (see below) |
| BUG-005 | bug | Blocking I/O (`readFileSync`/`writeFileSync`) in async | medium | `grep -rnE 'readFileSync\|writeFileSync'` |
| BUG-006 | bug | Unbounded loop (`while (true)`) | medium | `grep -rnE 'while\s*\(\s*true\s*\)'` |
| PERF-001 | performance | Synchronous file I/O in async function | medium | `grep -rnE 'readFileSync\|writeFileSync'` |
| PERF-002 | performance | Wildcard import (`import *`) | low | `grep -rnE 'import\s*\*\s*from'` |
| QUAL-001 | quality | Dead / unreachable code | low | structural check (see below) |
| QUAL-002 | quality | Missing JSDoc on public function | low | structural check (see below) |
| QUAL-003 | quality | Copy-paste block > 3 lines | low | structural check (see below) |

**Structural rules** (SEC-004, BUG-004, QUAL-001/002/003) cannot be detected by a single grep. For these, inspect the file directly and apply the rule's definition. If a structural rule cannot be confirmed, do **not** record a finding — absence of evidence is not a finding.

### Detection

For each file, run every grep rule in the catalog. Record findings as `(rule_id, file, count)`. **Never include matched line content in output** — see the security gotcha below.

```bash
# Run a single rule across a file; capture count only
COUNT=$(grep -rncE '<pattern>' "$file" 2>/dev/null | awk -F: '{s+=$NF}END{print s}')
COUNT=${COUNT:-0}
```

### Scoring

Compute a deterministic health score per directory from the finding counts. **Weights are fixed — do not change them.**

| Severity | Weight (deduction per finding) |
|----------|-------------------------------|
| critical | 25 |
| high | 10 |
| medium | 4 |
| low | 1 |

```bash
SCORE=$(( 100 - (25*CRITICAL + 10*HIGH + 4*MEDIUM + 1*LOW) ))
if [ "$SCORE" -lt 0 ]; then SCORE=0; fi
```

### Grade

Map the score to a grade band. This mapping is fixed.

| Grade | Score range | Meaning |
|-------|-------------|---------|
| A | 90–100 | Healthy — no critical/high findings |
| B | 75–89 | Minor issues — low/medium findings only |
| C | 60–74 | Needs attention — medium findings present |
| D | 40–59 | Significant issues — multiple high findings |
| F | 0–39 | Critical — data breach / auth bypass / crash risk |

### Decision Tool Rubric

If the harness provides a structured-decision tool (e.g., `decision`), use its `score` question type to assign the grade. Pass the computed score and finding counts as state. The ordered criteria are the grade bands, lowest to highest.

```
Question: "Score the overall code health of this directory."
Type: score
State: { score: <computed score>, critical: <N>, high: <N>, medium: <N>, low: <N> }
Criteria (lowest to highest):
  1 = F: critical defects, data breach / auth bypass / crash risk present, score < 40
  2 = D: significant issues, multiple high-severity findings, score 40-59
  3 = C: needs attention, medium-severity findings present, score 60-74
  4 = B: minor issues, only low/medium findings, score 75-89
  5 = A: healthy, no critical or high findings, score 90-100
```

Interpret the returned score directly: `1` → F, `2` → D, `3` → C, `4` → B, `5` → A. If no decision tool is available, fall back to the deterministic grade mapping above.

---

## State Management

Use a state file to persist progress across responses. The state file is cleaned at the start of a new audit and at the end when all phases are complete.

### State File Location

The state file path is provided in the chain context (the text after `/review-code`). If no path is provided, default to an example name like `review-state.md` — the agent decides where to place it.

To prevent collisions when multiple instances run, include a session identifier in the path:

```bash
SESSION_ID=$(head -c 8 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || echo $RANDOM$RANDOM$RANDOM)
STATE_FILE="${STATE_FILE_PATH:-review-state-${SESSION_ID}.md}"
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
     REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)\.git$/\1/')
   elif echo "$GIT_REMOTE" | grep -q 'github\.com'; then
     REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)\.git$/\1/')
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

7. **Proceed** to directory processing immediately.

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

3. **Audit each file.** For each file, run every rule in the catalog. Record `(rule_id, file, count)` for each rule that matches. Apply structural rules by direct inspection.

4. **Compute the score.** Sum the finding counts by severity, then apply the fixed weights:
   ```bash
   SCORE=$(( 100 - (25*CRITICAL + 10*HIGH + 4*MEDIUM + 1*LOW) ))
   if [ "$SCORE" -lt 0 ]; then SCORE=0; fi
   ```

5. **Assign the grade.** Use the decision tool rubric if available; otherwise use the deterministic grade mapping.

6. **Create Issue.** Invoke the `create-issue` skill with a synthesized description:
   ```
   create-issue Audit findings for $CURRENT_PHASE: Grade <GRADE> (score <SCORE>). Found N critical, N high, N medium, N low issues. See audit results below for details.
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

   **After creating the issue (or failing to), continue to Step 7.** Do not stop or wait for further input — the pipeline proceeds automatically.

7. **Update Issue Body.** Append a structured audit table to the issue. Collect findings into a temp file, then write them to the issue:

   ```bash
   AUDIT_FILE=$(mktemp)

   # Write the audit table header
   printf "| Rule | File | Severity | Summary |\n|------|------|----------|---------|\n" > "$AUDIT_FILE"

   # Append each finding as a table row (populated from the audit results collected above)
   # Example: printf "| SEC-001 | src/foo.js | critical | Hardcoded secret pattern (N occurrences) |\n" >> "$AUDIT_FILE"

   gh issue edit "$ISSUE_NUMBER" --body-file "$AUDIT_FILE" --repo "$REPO"

   # Verify the body was updated successfully
   VERIFY_BODY=$(gh issue view "$ISSUE_NUMBER" --json body --jq '.body' --repo "$REPO" 2>/dev/null || true)
   if ! echo "$VERIFY_BODY" | grep -q "Rule.*File.*Severity.*Summary"; then
     echo "WARNING: Failed to verify audit table was written to issue #$ISSUE_NUMBER."
   else
     echo "Audit table verified on issue #$ISSUE_NUMBER."
   fi

   rm -f "$AUDIT_FILE"
   ```

8. **Update State.** Mark the directory as completed in the state file:
    ```bash
    # Use | as sed delimiter to safely handle directory paths containing /
    ESCAPED_PHASE=$(echo "$CURRENT_PHASE" | sed 's/[|&]/\\&/g')
    sed -i "s|- \[ \] $ESCAPED_PHASE|- [x] $ESCAPED_PHASE|" "$STATE_FILE"
    # Append findings
    echo "" >> "$STATE_FILE"
    echo "## Findings: $CURRENT_PHASE" >> "$STATE_FILE"
    echo "[Findings stored here]" >> "$STATE_FILE"
    ```

9. **Report Output.** Use the standard Output Format below.

10. **Advance.** Move to the next directory in the queue. If none remain, delete the state file (`rm -f "$STATE_FILE"`) and report completion.

---

## Execution Rules

1. **STATE PERSISTENCE.** Always save state after processing each directory. Always read state before starting a new directory.
2. **ONE ISSUE PER DIRECTORY.** Do not combine multiple directories into a single issue.
3. **DETERMINISM.** Severity comes from the rule catalog, never from judgment. Score and grade come from the fixed weights and mapping. Do not re-grade or re-weight.
4. **STOP CONDITION.** Terminate when all directories in the phase queue have been processed.

## Error Handling

- **State file not found:** If the state file doesn't exist on resume, begin fresh from Phase 0.
- **Directory not found:** If a directory in the phase queue doesn't exist, skip it and log a warning.
- **gh CLI not authenticated:** Suggest running `gh auth login`.
- **Network error:** Retry once, then report the failure and skip the current directory.
- **create-issue failure:** Log the error, skip issue creation for this directory, and continue. Do not abort the audit.
- **Partial audit:** If some directories succeed and others fail, report what was accomplished. Never leave the audit half-done.
- **Rate limit:** If GitHub API returns 403 rate limit, wait 60 seconds and retry once.

## Gotchas

- **Security findings must never include raw secret values.** The audit table only reports rule ID, pattern type, and count — never the matched line content. Writing secrets to a GitHub issue exposes them to anyone with repo access.
- **State file cleanup is critical.** Always delete the state file at the start of a new audit and at the end when complete. Stale state files cause incorrect resume behavior.
- **`gh` CLI must be authenticated before starting.** The audit will fail silently at Step 7 if `gh` is not logged in. Run `gh auth login` first.
- **Structural rules need confirmation.** Do not record a finding for SEC-004, BUG-004, QUAL-001/002/003 unless you confirmed it by direct inspection. Absence of evidence is not a finding.
- **Do not double-count.** A single line may match multiple rules (e.g., `readFileSync` matches both BUG-005 and PERF-001). Record each rule independently; the weighted score accounts for the overlap.

## Output Format

Each phase response must include:

```
## Audit: [directory path]
- **Status:** completed | blocked | no-issues
- **Grade:** [A|B|C|D|F] (score: [N]/100)
- **Files Audited:** [count]
- **Issues Found:** [count] (critical: N, high: N, medium: N, low: N)
- **Details:**
  - [key-finding-1]
  - [key-finding-2]
- **Action Items:** [issue created with ID or "No issues detected"]
- **Next Steps:** [next directory name or "All phases complete"]
```
