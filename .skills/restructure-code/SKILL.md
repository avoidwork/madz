---
name: restructure-code
description: "Audits each directory in ./src for opportunities to restructure directories to align with community best practices & better organization in general. Generates one consolidated issue per directory via /create-issue."
license: BSD 3-Clause
compatibility: Node.js project with ./src directory structure
metadata:
  version: 1.0.0
  phase-mode: strict-sequential
  target: ./src
  agent: code-review
---

# Restructure Code

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Audit the `./src` directory tree for opportunities to restructure directories to align with community best practices and better organization. Execute in **strict sequential phases** — one directory per phase, no lookahead, no batching.

## State Management

Use a state file to persist progress across responses. The state file is cleaned at the start of a new audit and at the end when all phases are complete.

### State File Location

An example name like `restructure-state.md` — the agent decides where to place it.

Store the path in a variable:
```bash
STATE_FILE="${STATE_FILE_PATH:-restructure-state.md}"
```

### State File Format

```markdown
# Restructure State

## Phase Queue
- [x] ./src
- [ ] ./src/components
- [ ] ./src/utils

## Current Phase
./src/components

## Completed
- ./src

## Findings
[Current phase findings stored here as markdown table]
```

### State Lifecycle

1. **Start of audit** — Delete any existing state file. Begin fresh.
2. **After each phase** — Save the current state (completed directories, current phase, findings).
3. **On resume** — Read the state file to determine where to pick up.
4. **End of audit** — Delete the state file once all phases are complete.

---

## Phase Protocol

### Phase 0: Discovery

1. **Clean state.** Delete any existing state file: `rm -f "$STATE_FILE"`
2. **Enumerate directories.** List all immediate subdirectories of `./src`:
   ```bash
   find ./src -mindepth 1 -maxdepth 1 -type d | sort
   ```
3. Sort them alphabetically (the `find | sort` above handles this).
4. The root `./src` itself is Phase 1.
5. Build the phase queue: `[./src, subdir1, subdir2, ...]` in alphabetical order.
6. **Save the phase queue** to the state file:
   ```bash
   cat > "$STATE_FILE" << EOF
   # Restructure State

   ## Phase Queue
   - [x] ./src
   EOF
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
7. **Proceed immediately** to Phase 1 (the first directory in the queue). Do not wait for user confirmation.

### Per-Phase Workflow (repeat for each directory)

#### Step 0: Resume Check

Before beginning a phase, check for existing state:

1. Read An example name like `restructure-state.md` — the agent decides where to place it..
2. If the file exists and the current phase matches the directory being processed, continue.
3. If the file exists and a different phase is listed as current, the audit was interrupted — resume from the saved state.
4. If the file does not exist, begin fresh.

#### Step A: Enumerate Files

Determine the scope based on the current phase:
- **If the phase is `./src` (root):** List only files directly in the `./src` directory (non-recursive).
- **If the phase is a subdirectory:** List all source files recursively within that subdirectory only.

Exclude:
- `node_modules/`
- `__tests__/` or `*.test.*` / `*.spec.*`
- Generated files (`.js.map`) — **Note:** `.d.ts` files are NOT excluded; they provide valuable type information for understanding structure
- Config files (`tsconfig.json`, `.eslintrc`, etc.)
- Static assets (`.png`, `.jpg`, `.svg`, `.css`)

Acceptable targets: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.d.ts`.

**Handle empty directories:** If no source files are found after filtering, log "No source files found in [directory]. Skipping analysis." and move to the next phase. Do not create an issue for empty directories.

#### Step B: Analyze Structure

For each directory, perform a **sequential** analysis for restructuring opportunities:

1. **Cohesion** — Are related files scattered? Do files in this directory share a common purpose, or is it a grab-bag of unrelated concerns? Look for:
   - Files that logically belong together but are split across directories
   - Directories that mix multiple concerns (e.g., UI components mixed with business logic)
   - Orphaned files with no clear parent category

2. **Coupling** — Are there cross-directory dependencies that suggest consolidation? Look for:
   - Files in this directory that import heavily from a single other directory
   - Bidirectional imports between two directories (suggests they should be one)
   - Shared utilities duplicated across multiple directories

3. **Naming & Convention** — Does the directory follow established patterns? Look for:
   - Inconsistent naming (e.g., `utils` vs `helpers`, `components` vs `ui`)
   - Directories that don't match common architectural patterns (feature-based, layer-based, domain-driven)
   - Mixed conventions within a single directory (e.g., some files use PascalCase, others camelCase for grouping)

4. **Depth & Nesting** — Is the directory tree too deep or too flat? Look for:
   - Nesting deeper than 3-4 levels (hard to navigate, long import paths)
   - Directories with only 1-2 files that could be merged with siblings
   - Flat directories with 20+ files that should be subdivided

5. **Pattern Alignment** — Does the structure align with community best practices? Look for:
   - Opportunities to adopt feature-based organization (group by feature, not by type)
   - Opportunities to adopt layer-based organization (separate UI, business logic, data access)
   - Opportunities to adopt domain-driven boundaries
   - Mixed organizational patterns within the same project

For each finding, record:
- **File/Directory** — relative path from project root
- **Issue Type** — `cohesion`, `coupling`, `naming`, `depth`, or `pattern`
- **Impact** — `high`, `medium`, or `low`
- **Summary** — one-line description of the restructuring opportunity
- **Recommendation** — brief suggested action

#### Step C: Consolidate Findings

After analyzing all files in the directory:

- **If zero issues found:** Log "No restructuring opportunities detected in [directory]." and move to the next phase.
- **If issues found:** Proceed to Step D.

#### Step D: Create Issue

Invoke the `create-issue` skill as a chain instruction (text delegation). The issue body will be replaced in Step D2.

The title should be concise and descriptive, prefixed with `refactor:` since restructuring is a refactor. Example: `refactor: restructure src/components for better cohesion`

**Capture the issue number** from the `create-issue` output. The `create-issue` skill prints `ISSUE_NUMBER=<number>` as structured output. Read it from the conversation history:

```bash
# Capture ISSUE_NUMBER from the conversation history (last occurrence wins)
# The chained skill prints lines like: ISSUE_NUMBER=42
ISSUE_NUMBER=$(echo "$CONVERSATION_HISTORY" | sed -n 's/^ISSUE_NUMBER=\([0-9]\{1,\}\)$/\1/p' | tail -1)
if [ -z "$ISSUE_NUMBER" ]; then
  echo "ERROR: Could not capture ISSUE_NUMBER from create-issue output. Conversation history:"
  echo "$CONVERSATION_HISTORY" | tail -20
  exit 1
fi
echo "ISSUE_NUMBER=$ISSUE_NUMBER"
```

**If create-issue fails:** Log the error, skip Step D2 (body update), and proceed to Step E. Do not abort the phase.

**After creating the issue (or failing to), continue to Step D2.** Do not stop or wait for further input — the pipeline proceeds automatically.

##### Step D2: Replace Issue Body

Once the issue is created, replace the dummy body with the full restructuring analysis.

**Write the analysis to a temp file** to avoid echo escaping issues with multi-line content and backticks:

**Cleanup:** Remove `BODY_FILE` once the issue is created, or when cleaning up after a failure. Do not rely on a shell `trap` — delete the temp file explicitly when the task completes.

```bash
BODY_FILE=$(mktemp)

# Build the full analysis body — use heredoc to preserve formatting
cat > "$BODY_FILE" << BODYEOF
## Restructure Analysis: $DIRECTORY_NAME

### Summary
$SUMMARY_TEXT

### Findings

| File/Directory | Issue Type | Impact | Summary | Recommendation |
|---------------|-----------|--------|---------|----------------|
$FINDINGS_TABLE

### Proposed Structure

\`\`\`
$PROPOSED_STRUCTURE
\`\`\`

### Restructuring Priority
1. $HIGH_PRIORITY_ITEMS
2. $MEDIUM_PRIORITY_ITEMS
3. $LOW_PRIORITY_ITEMS
BODYEOF

# Update the issue — use dynamic repo variable derived from git remote
GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
if echo "$GIT_REMOTE" | grep -q 'github\.com'; then
  REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)\.git$/\1/')
  if [ -z "$REPO" ]; then
    REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)$/\1/')
  fi
  GH_REPO_OPT="--repo $REPO"
else
  echo "WARNING: Could not parse GitHub repository from remote. Skipping issue body update."
  GH_REPO_OPT=""
fi

if [ "$ISSUE_NUMBER" != "unknown" ]; then
  gh issue edit "$ISSUE_NUMBER" --body-file "$BODY_FILE" $GH_REPO_OPT 2>&1
  if [ $? -ne 0 ]; then
    echo "WARNING: Failed to update issue body. Issue $ISSUE_NUMBER exists but body was not updated."
  else
    # Verify the body was updated successfully
    VERIFY_BODY=$(gh issue view "$ISSUE_NUMBER" --json body --jq '.body' $GH_REPO_OPT 2>/dev/null || true)
    if ! echo "$VERIFY_BODY" | grep -q "Restructure Analysis: $DIRECTORY_NAME"; then
      echo "WARNING: Failed to verify restructure analysis was written to issue #$ISSUE_NUMBER."
    else
      echo "Restructure analysis verified on issue #$ISSUE_NUMBER."
    fi
  fi
fi

rm -f "$BODY_FILE"
```

**Key variable replacements:**
- `$DIRECTORY_NAME` — the directory being analyzed (e.g., `src/components`)
- `$SUMMARY_TEXT` — brief summary of findings
- `$FINDINGS_TABLE` — markdown table rows (one per finding)
- `$PROPOSED_STRUCTURE` — proposed directory tree
- `$HIGH_PRIORITY_ITEMS`, `$MEDIUM_PRIORITY_ITEMS`, `$LOW_PRIORITY_ITEMS` — prioritized lists

**Never use `echo` for multi-line content** — always use heredoc (`cat > file << EOF`) to avoid escaping issues with backticks, special characters, and newlines.

#### Step E: Update State

After completing the phase (issue created or no issues found), update the state file:

1. **Mark the current directory as completed** in the phase queue:
    ```bash
    # Use | as sed delimiter instead of / to handle directory paths safely
    ESCAPED_DIR=$(echo "$CURRENT_DIR" | sed 's/[|/]/\\&/g')
    sed "s|- \[ \] $ESCAPED_DIR|- [x] $ESCAPED_DIR|" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    ```
2. **Append to Completed section:**
   ```bash
   sed '/^## Completed$/a - '"$CURRENT_DIR" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
   ```
3. **Update Current Phase** to the next directory in the queue, or clear it if this was the last:
   ```bash
   NEXT_DIR=$(grep -A100 "## Phase Queue" "$STATE_FILE" | grep "\- \[ \]" | head -1 | sed 's/- \[ \] //')
   if [ -n "$NEXT_DIR" ]; then
     sed "s/^## Current Phase$/## Current Phase\n$NEXT_DIR/" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
   else
     sed '/^## Current Phase$/d' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
   fi
   ```
4. **Save the updated state** to `$STATE_FILE` (the sed commands above modify in place).

Example state after completing `./src`:

```markdown
# Restructure State

## Phase Queue
- [x] ./src
- [x] ./src/components
- [ ] ./src/utils

## Current Phase
./src/utils

## Completed
- ./src
- ./src/components

## Findings
[Next phase findings will be stored here]
```

#### Step E2: Check Completion

After updating state, check if all phases are complete:

- **If all directories are marked `[x]`:** Delete the state file (`rm -f "$STATE_FILE"`) and report "All phases complete."
- **If more directories remain:** Automatically proceed to the next phase in the queue.

#### Step E3: Phase Complete

- Log completion of the current directory.
- **Auto-advance** to the next phase immediately.
- Do NOT wait for user confirmation unless the audit is fully complete.

## Execution Rules

1. **ONE PHASE PER RESPONSE.** Each response processes exactly one directory. The skill will **auto-advance** to the next phase immediately upon completion, requiring no manual prompts between phases.
2. **STRICT ORDERING.** Process directories in alphabetical order. Parent before child.
3. **NO LOOKAHEAD.** Do not read files from the next directory until the current phase is complete.
4. **NO BATCHING.** Do not combine multiple directories into a single issue or response.
5. **SEQUENTIAL FILE ANALYSIS.** Analyze files one at a time within a directory.
6. **STOP CONDITION.** Terminate when all directories in the phase queue have been processed.
7. **STATE PERSISTENCE.** Always save state after each phase. Always read state before starting a phase.

## Impact Guidelines

| Impact | Criteria |
|--------|----------|
| **High** | Major cohesion/coupling issues, mixed concerns, structural anti-patterns that significantly impact maintainability |
| **Medium** | Naming inconsistencies, pattern misalignment, moderate nesting issues, duplicated utilities |
| **Low** | Minor organizational tweaks, naming conventions, cosmetic restructuring |

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to classify each finding's impact. Issue one `choice` question per finding, passing the finding as state.

```
Question: "What is the impact of this restructuring opportunity?"
Type: choice
Options: high, medium, low
Criteria:
  high   = major cohesion/coupling issues, mixed concerns, structural anti-patterns
  medium = naming inconsistencies, pattern misalignment, moderate nesting, duplicated utilities
  low    = minor organizational tweaks, naming conventions, cosmetic restructuring
Example answer: medium
```

Interpret the returned label directly. Fall back to the impact guidelines above if no decision tool is available.

## Output Format

Each phase response must include:

```
## Restructure: [directory path]
- **Status:** completed | blocked | no-issues
- **Files Analyzed:** [count]
- **Opportunities Found:** [count] (high: N, medium: N, low: N)
- **Details:**
  - [key-finding-1]
  - [key-finding-2]
- **Action Items:** [issue created with ID or "No restructuring opportunities detected"]
- **Next Steps:** [next directory name or "All phases complete"]
```