---
name: review-code
description: Audits a directory tree for bugs, security vulnerabilities, and performance issues across the languages installed in the project Dockerfile (JavaScript/TypeScript, Python, Ruby, Go, Java, Rust, Terraform, Shell). Uses a deterministic per-language rule catalog with fixed severities and a weighted scoring rubric. Generates one consolidated issue per directory via /create-issue. Use when auditing a codebase for language-specific code quality.
license: BSD 3-Clause
compatibility: Supports JS/TS, Python, Ruby, Go, Java, Rust, Terraform, and Shell. Requires git CLI and gh CLI for issue creation.
metadata:
  version: 2.4.0
  target: ./src
  agent: code-review
---

# Review Code

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Audit a directory tree for bugs, security vulnerabilities, and performance issues. Directories are independent — each gets its own issue.

The audit is **language-agnostic** and **deterministic**: files are classified by language, each language has a fixed rule catalog with fixed severities, and overall health is a computed score. No subjective severity judgment is required.

---

## Language Support

The skill supports the languages installed in the project's `Dockerfile`. Each language has its own rule catalog in `references/` (progressive disclosure — load the relevant file only when auditing that language).

| Language | Extensions | Rule catalog |
|----------|------------|--------------|
| JavaScript / TypeScript | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` | `references/javascript.md` |
| Python | `.py`, `.pyi` | `references/python.md` |
| Ruby | `.rb` | `references/ruby.md` |
| Go | `.go` | `references/go.md` |
| Java | `.java` | `references/java.md` |
| Rust | `.rs` | `references/rust.md` |
| Terraform | `.tf`, `.hcl` | `references/terraform.md` |
| Shell | `.sh`, `.bash` | `references/shell.md` |

**Load the rule catalog for each language you encounter.** Read the corresponding `references/<language>.md` before auditing files of that language. Do not audit a language without its catalog.

---

## Deterministic Audit Method

### Universal Rules

The following rules apply to **every** language and are defined here. Language-specific rules live in the per-language catalogs.

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-005 | security | Unsafe URL scheme (`file://`, `gopher://`, `dict://`) | high | `grep -rnE '(file\|gopher\|dict)://'` |
| QUAL-001 | quality | Dead / unreachable code | low | structural check (see below) |
| QUAL-002 | quality | Missing doc comment on public symbol | low | structural check (see below) |
| QUAL-003 | quality | Copy-paste block > 3 lines | low | structural check (see below) |

**Structural rules** (QUAL-001/002/003) cannot be detected by a single grep. Apply the concrete detection criteria below. Each criterion is checkable — if the file does not satisfy the criterion, do **not** record a finding. Absence of evidence is not a finding.

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| QUAL-001 | A statement or block is unreachable: it follows an unconditional `return`, `throw`, `break`, or `continue` in the same block, or a function has a `return`/`throw` on every path followed by trailing code. |
| QUAL-002 | A top-level `export function`/`export const`/`export class` (or a module-level function/class) has no doc comment (`/** ... */`, `"""..."""`, `# ...`, or `// ...`) immediately preceding it. |
| QUAL-003 | Two or more blocks of 4+ consecutive lines are byte-identical (ignoring whitespace) within the same file. |

### Per-Language Rules

Each `references/<language>.md` file defines the language-specific rules (e.g., unhandled promises in JS, mutable default args in Python, ignored errors in Go, `unwrap()` in Rust). **Severity is a property of each rule — never a judgment call.** Do not re-grade a finding.

### Detection

For each file, determine its language by extension, load that language's catalog, and run every rule in it. Record findings as `(rule_id, file, count)`. **Never include matched line content in output** — see the security gotcha below.

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

2. **Enumerate files.** List all files in the target directory across all supported languages:
   ```bash
   # Recurse into subdirectories, excluding common patterns and build artifacts
   find "$CURRENT_PHASE" -type f \
     ! -path '*/node_modules/*' \
     ! -path '*/.git/*' \
     ! -path '*/__tests__/*' \
     ! -path '*/test/*' \
     ! -path '*/tests/*' \
     ! -path '*/.next/*' \
     ! -path '*/dist/*' \
     ! -path '*/build/*' \
     ! -path '*/target/*' \
     ! -path '*/vendor/*' \
     ! -path '*/__pycache__/*' \
     ! -name '*.test.*' \
     ! -name '*.spec.*' \
     ! -name '*.d.ts' \
     ! -name '*.js.map' \
     ! -name '*.min.*' \
     \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' -o -name '*.cjs' \
        -o -name '*.py' -o -name '*.pyi' \
        -o -name '*.rb' \
        -o -name '*.go' \
        -o -name '*.java' \
        -o -name '*.rs' \
        -o -name '*.tf' -o -name '*.hcl' \
        -o -name '*.sh' -o -name '*.bash' \)
   ```

3. **Classify each file by language.** Map each file's extension to a language per the Language Support table. Load that language's rule catalog from `references/`.

4. **Audit each file.** For each file, run every rule in its language's catalog plus the universal rules. Record `(rule_id, file, count)` for each rule that matches. Apply structural rules by direct inspection.

5. **Compute the score.** Sum the finding counts by severity, then apply the fixed weights per the **Scoring** section above (the formula is defined there — do not redefine it).

6. **Assign the grade.** Use the decision tool rubric if available; otherwise use the deterministic grade mapping.

7. **Report Output.** Display the audit results using the standard Output Format below. Do **not** file an issue yet.

8. **Prompt to file issues.** Use the `clarify` tool to ask whether to file a GitHub issue for this directory's findings. Do **not** invoke `create-issue` automatically — the user decides.

   ```
   Question: "File a GitHub issue for the audit findings in $CURRENT_PHASE?"
   Type: choice
   Options: yes, no
   ```

   - If the answer is **no**, skip issue creation and body update. Proceed to Step 10 (Update State).
   - If the answer is **yes**, proceed to Step 9.

9. **Create Issue** (only if the user chose yes). Invoke the `create-issue` skill with a synthesized description:
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

   **After creating the issue (or failing to), continue to Step 10.** Do not stop or wait for further input — the pipeline proceeds automatically.

10. **Update Issue Body** (only if an issue was created). Append a structured audit table to the issue. Collect findings into a temp file, then write them to the issue:

   ```bash
   AUDIT_FILE=$(mktemp)

   # Write the audit table header
   printf "| Rule | File | Severity | Summary |\n|------|------|----------|---------|\n" > "$AUDIT_FILE"

   # Append each finding as a table row (populated from the audit results collected above)
   # Example: printf "| SEC-001 | src/foo.py | critical | Hardcoded secret pattern (N occurrences) |\n" >> "$AUDIT_FILE"

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

11. **Update State.** Mark the directory as completed in the state file:
    ```bash
    # Use | as sed delimiter to safely handle directory paths containing /
    ESCAPED_PHASE=$(echo "$CURRENT_PHASE" | sed 's/[|&]/\\&/g')
    sed -i "s|- \[ \] $ESCAPED_PHASE|- [x] $ESCAPED_PHASE|" "$STATE_FILE"
    # Append findings
    echo "" >> "$STATE_FILE"
    echo "## Findings: $CURRENT_PHASE" >> "$STATE_FILE"
    echo "[Findings stored here]" >> "$STATE_FILE"
    ```

12. **Advance.** Move to the next directory in the queue. If none remain, delete the state file (`rm -f "$STATE_FILE"`) and report completion.

---

## Execution Rules

1. **STATE PERSISTENCE.** Always save state after processing each directory. Always read state before starting a new directory.
2. **ONE ISSUE PER DIRECTORY.** Do not combine multiple directories into a single issue.
3. **LANGUAGE CATALOGS.** Always load the per-language rule catalog before auditing files of that language. Do not audit a language without its catalog.
4. **DETERMINISM.** Severity comes from the rule catalog, never from judgment. Score and grade come from the fixed weights and mapping. Do not re-grade or re-weight.
5. **STOP CONDITION.** Terminate when all directories in the phase queue have been processed.

## Error Handling

- **State file not found:** If the state file doesn't exist on resume, begin fresh from Phase 0.
- **Directory not found:** If a directory in the phase queue doesn't exist, skip it and log a warning.
- **Unknown language:** If a file's extension is not in the Language Support table, skip it and log a warning. Do not guess a language.
- **Missing rule catalog:** If a language's `references/<language>.md` is missing, skip that language's files and log a warning. Do not audit without a catalog.
- **gh CLI not authenticated:** Suggest running `gh auth login`.
- **Network error:** Retry once, then report the failure and skip the current directory.
- **create-issue failure:** Log the error, skip issue creation for this directory, and continue. Do not abort the audit.
- **clarify declined:** If the user declines to file an issue, skip issue creation and body update for that directory, update state, and continue to the next directory.
- **Partial audit:** If some directories succeed and others fail, report what was accomplished. Never leave the audit half-done.
- **Rate limit:** If GitHub API returns 403 rate limit, wait 60 seconds and retry once.

## Gotchas

- **Security findings must never include raw secret values.** The audit table only reports rule ID, pattern type, and count — never the matched line content. Writing secrets to a GitHub issue exposes them to anyone with repo access.
- **State file cleanup is critical.** Always delete the state file at the start of a new audit and at the end when complete. Stale state files cause incorrect resume behavior.
- **`gh` CLI must be authenticated before starting.** The audit will fail silently at Step 10 if `gh` is not logged in. Run `gh auth login` first.
- **Structural rules need confirmation.** Do not record a finding for QUAL-001/002/003 unless you confirmed it by direct inspection. Absence of evidence is not a finding.
- **Do not double-count.** A single line may match multiple rules (e.g., `readFileSync` matches both a blocking-I/O and a sync-I/O rule). Record each rule independently; the weighted score accounts for the overlap.
- **Language best practices.** Each per-language catalog includes language-specific best practices. Apply them when auditing that language — they are part of the rule set, not optional commentary.

## Output Format

Each phase response must include:

```
## Audit: [directory path]
- **Status:** completed | blocked | no-issues
- **Grade:** [A|B|C|D|F] (score: [N]/100)
- **Languages:** [comma-separated list of languages audited]
- **Files Audited:** [count]
- **Issues Found:** [count] (critical: N, high: N, medium: N, low: N)
- **Details:**
  - [key-finding-1]
  - [key-finding-2]
- **Action Items:** [issue created with ID, "No issues detected", or "Awaiting user decision on filing"]
- **Next Steps:** [next directory name or "All phases complete"]
```
