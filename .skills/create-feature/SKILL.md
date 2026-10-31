---
name: create-feature
description: Orchestrates a complete feature lifecycle: receive goals, synthesize specs, propose via OpenSpec, commit specs to PR, apply tasks, commit implementation, archive, update PR, and post audit results. Creates an isolated git worktree for each run.
license: BSD 3-Clause
compatibility: Requires Node.js 24+, npm, git with remote access, gh CLI, openspec CLI, and a project root with openspec/ directory. Requires git worktree support. When invoked as a sub-agent, requires a 30–60 minute timeout — the full pipeline (spec → PR → implement → archive → update PR) can take that long.
metadata:
  agent: coding
---

# Create Feature

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Orchestrate a complete feature lifecycle from raw goals to shipped code. This is the full pipeline — synthesis, specification, implementation, verification, delivery, and archive.

## Prerequisites

Before starting, ensure:
- You are in the project root directory (contains `package.json`, `openspec/`)
- `gh` CLI is authenticated and configured
- `openspec` CLI is available
- The current branch is `main` (or will be checked out at step 0)

## Input Parsing

The input may include a `BRANCH_TYPE` prefix (e.g., `BRANCH_TYPE=fix create-feature ...`). Extract it if present in the conversation context.

Read `BRANCH_TYPE` from the conversation history if provided by the invoking skill. If not present, default to `feat`.

## Input

The user provides a list of goals/features in any format (natural language, JSON, markdown list, etc.). Parse and normalize them into a clean array of goal strings.

**Example input:**
> Add a new tool that can summarize web pages, and improve the TUI memory panel to show retention stats.

**Normalized goals:**
1. Add a new tool that can summarize web pages
2. Improve the TUI memory panel to show retention stats

---

## Step 0: Ensure Clean State

**Capture the project root and repository info (needed for worktree paths and gh commands):**

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
if echo "$GIT_REMOTE" | grep -q '^git@'; then
  GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\).git$/\1/')
elif echo "$GIT_REMOTE" | grep -q 'github\.com'; then
  GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\).git$/\1/')
fi

if [ -z "$GH_REPO" ]; then
  echo "ERROR: Could not determine repository from git remote '$GIT_REMOTE'."
  exit 1
fi
echo "GH_REPO=$GH_REPO"
```

**Create a dedicated worktree directory as a sibling of the repo root.** Placing it *outside* the repo (e.g., `madz.worktrees/` next to `madz/`) avoids nesting a git repository inside the main working tree. A nested worktree is a known git footgun: it shows up as a nested repo to `git status`/`git clean`, and requires a `.gitignore` entry to hide it. A sibling directory keeps the repo pristine — no ignore entry needed, `git clean -fdx` is a no-op, and the worktree is still tracked normally via the `.git` file pointing back into the repo's `.git/worktrees/`.

```bash
WORKTREES_DIR="$(dirname "$PROJECT_ROOT")/$(basename "$PROJECT_ROOT").worktrees"
mkdir -p "$WORKTREES_DIR"
```

```bash
# Only checkout main if not already on it
if [ "$(git branch --show-current)" != "main" ]; then
  # Verify main exists on remote before pulling
  REMOTE_MAIN=$(git ls-remote --heads origin main 2>/dev/null)
  if [ -n "$REMOTE_MAIN" ]; then
    git fetch origin main
    git checkout main
    git pull origin main
  else
    echo "WARNING: No remote branch 'main' found. Current branch '$(git branch --show-current)' will be used as-is."
  fi
fi
```

Verify the working tree is clean:
```bash
git status --porcelain
```

If there are uncommitted changes, report them and stop. Do not proceed with a dirty tree.

---

## Step 0.5: Capture Session ID

Capture a unique session identifier so that multiple instances (e.g., subagents) can run in parallel without file collisions.

```bash
# Portable: works in Alpine, minimal images, and standard Linux
# Generates 8 random hex chars from /dev/urandom, falls back to $RANDOM if unavailable
SESSION_ID=$(head -c 8 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || echo $RANDOM$RANDOM$RANDOM)
echo "SESSION_ID=$SESSION_ID"
```

**Where to store temp files:** The agent running this skill decides where to place temp files. Use example names like `${SESSION_ID}-feature-goals.md`, `${SESSION_ID}-feature-prompt.md`, `${SESSION_ID}-audit-results.md`, and `${SESSION_ID}-pr-number.txt`. The agent may place them in `tmp/`, `state/`, or any other directory that fits the project's conventions.

**Cleanup:** The agent must remove all temp files and the worktree when the task completes, and also when cleaning up after a failure or interruption. Do not rely on a shell `trap` — explicitly clean up work files at the end of the task or during failure cleanup. The worktree path is defined in Step 0.75; the agent should track it and remove it as part of cleanup.

---

## Step 0.75: Create Isolated Worktree

Create a dedicated git worktree so all feature work is isolated from the main working tree. Using absolute paths (`PROJECT_ROOT`) prevents the worktree from being nested inside another worktree.

```bash
WORKTREE_PATH="${WORKTREES_DIR}/${SESSION_ID}"

# Create the worktree from main (--detach since main is already checked out)
git worktree add --detach "$WORKTREE_PATH" main

# Verify worktree creation succeeded
if [ ! -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Worktree creation failed at $WORKTREE_PATH."
  exit 1
fi

# Record the original directory so we can return for cleanup
ORIGINAL_DIR=$(pwd)
echo "WORKTREE_PATH=$WORKTREE_PATH"
```

**Change into the worktree** — all subsequent steps run from here:

```bash
cd "$WORKTREE_PATH"
```

**Cleanup:** When the task completes, or when cleaning up after a failure or interruption, the agent must remove the worktree and all temp files. Do not rely on a shell `trap` — explicitly clean up work files at the end of the task or during failure cleanup. Remove the worktree with `git worktree remove "$WORKTREE_PATH" --force` (falling back to `rm -rf "$WORKTREE_PATH"` if needed), return to `$ORIGINAL_DIR`, and delete the temp files (`${SESSION_ID}-feature-goals.md`, `${SESSION_ID}-feature-prompt.md`, `${SESSION_ID}-audit-results.md`, `${SESSION_ID}-pr-number.txt`, `${SESSION_ID}-test-patterns.md`).

---

## Step 1: Synthesize Detailed Goals

Take the raw goals from the input and expand each into a more detailed, actionable specification. For each goal, produce:

- **Goal:** The original goal string
- **Scope:** What is included and explicitly excluded
- **Key Requirements:** 3-5 concrete requirements
- **Acceptance Criteria:** How success is measured
- **Dependencies:** Any existing code, configs, or specs that need to change
- **Risks / Edge Cases:** Potential pitfalls to consider

Write the detailed goals to a file named `${SESSION_ID}-feature-goals.md` (use an example name — the agent decides where to place it). This file serves as the source of truth for all subsequent audits.

---

## Step 2: Synthesize Proposal Prompt

Using the detailed goals from Step 1, synthesize a multi-paragraph proposal prompt suitable for feeding into `openspec-propose`. The prompt should:

- Start with a parseable change name on the first line: `CHANGE_NAME: <kebab-case-name>` (e.g., `CHANGE_NAME: web-page-summarizer-tui-memory-stats`)
- Include a concise summary of what is being built and why
- Describe the technical approach in 2-4 paragraphs
- Reference specific files, modules, and patterns in the codebase
- Note any architectural decisions or trade-offs
- Be specific enough that `openspec new change` + artifact generation will produce useful specs

Write the proposal prompt to a file named `${SESSION_ID}-feature-prompt.md` (use an example name — the agent decides where to place it).

---

## Step 3: Extract Change Name

Parse the change name from the proposal prompt in Step 2. This is the kebab-case identifier that will be used for the OpenSpec change directory.

```bash
CHANGE_NAME=$(grep -o 'CHANGE_NAME: .*' "${SESSION_ID}-feature-prompt.md" | sed 's/^CHANGE_NAME: //' | sed 's/ *$//' | head -1)
if [ -z "$CHANGE_NAME" ]; then
  CHANGE_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
fi
echo "CHANGE_NAME=$CHANGE_NAME"
```

---

## Step 3.5: Create Feature Branch

Determine the branch type from the input context. If the input contains a reference to an issue with a known type (e.g., from `fix-issue` chain), extract it. Otherwise, default to `feat`.

Valid types: `feat`, `fix`, `chore`, `docs`, `test`.

Strip any existing type prefix from `$CHANGE_NAME` to avoid double-prefixing:

```bash
# Determine branch type — default to feat if not specified
BRANCH_TYPE="${BRANCH_TYPE:-feat}"

# Validate branch type
case "$BRANCH_TYPE" in
  feat|fix|chore|docs|test) ;;
  *) BRANCH_TYPE="feat" ;;
esac

# Strip any existing type prefix from CHANGE_NAME to avoid double-prefixing
BRANCH_NAME=$(echo "$CHANGE_NAME" | sed 's/^\(feat\|fix\|chore\|docs\|test\)\///')
git checkout -b "${BRANCH_TYPE}/${BRANCH_NAME}"
```

Verify the branch was created:
```bash
git branch --show-current
```

---

## Step 4: Create OpenSpec Change

Run the OpenSpec propose workflow for the synthesized change:

```bash
openspec new change "$CHANGE_NAME"
```

Then generate all artifacts using this procedure (optimized for the automated pipeline):

1. Get the artifact build order:
   ```bash
   openspec status --change "$CHANGE_NAME" --json
   ```

2. For each artifact that is `ready` (dependencies satisfied):
   - Get instructions: `openspec instructions <artifact-id> --change "$CHANGE_NAME" --json`
   - Read any completed dependency files for context
   - Create the artifact file using the template and following the instructions
   - Re-run `openspec status --change "$CHANGE_NAME" --json` after each artifact

3. Continue until all `applyRequires` artifacts are complete.

After completion, verify all expected files exist:
```bash
ls -la openspec/changes/$CHANGE_NAME/
```

Expected files: `.openspec.yaml`, `proposal.md`, `design.md`, `tasks.md`, and any spec deltas in `specs/`.

If any expected file is missing, stop and report the error.

---

## Step 5: Audit Specs Against Goals (Up to 3 Iterations)

Read the detailed goals from the file named `${SESSION_ID}-feature-goals.md` (use an example name — the agent decides where to place it) and the generated spec documents (proposal.md, design.md, tasks.md, and any spec deltas).

Perform a thorough audit:

1. **Coverage audit:** Does every detailed goal have corresponding requirements in the specs?
2. **Fidelity audit:** Do the specs faithfully represent the original intent of each goal?
3. **Completeness audit:** Are there missing requirements, edge cases, or acceptance criteria not captured?
4. **Consistency audit:** Do the tasks in tasks.md map to the requirements in the specs?

Write audit findings to a file named `${SESSION_ID}-audit-results.md` (use an example name — the agent decides where to place it).

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to decide whether errors remain before iterating. Pass the audit findings as state.

```
Question: "Do the specs faithfully cover all goals with no errors?"
Type: noul
Criteria:
  false = missing requirements, fidelity gaps, or task-spec mismatch
  true  = all goals covered, faithful, complete, consistent
Example answer: false
```

**Important:** The `noul` type returns a *single float in [0,1]*, not a label — it is the probability of `true`. Interpret it as: `≥ 0.6` → true (no errors, proceed), `≤ 0.4` → false (errors remain, iterate), between → unknown. Fall back to manual review if no decision tool is available.

**If errors are found:**
- Fix the spec documents to address each finding
- Update tasks.md if task-to-spec mapping is broken
- Re-audit (increment iteration count)
- Repeat until no errors remain or 3 iterations are exhausted

**If no errors are found:**
- Proceed to Step 6

---

## Step 6: Commit & Push OpenSpec Files (via commit-push)

**Purpose:** Lock the spec documents into a pull request before implementation begins.

**Do not perform git operations inline.** Invoke the `commit-push` skill to handle staging, committing, pushing, and PR creation.

The `commit-push` skill will:
- Stage all OpenSpec files and spec deltas
- Commit using conventional commit format from the scanned project rules §5.1
- Push to the remote
- Create a PR using the template from the scanned project rules §5.4
- Print structured output: `PR_NUMBER=<number>` and `PR_URL=<url>`

Read the `PR_NUMBER` from the structured output printed by `commit-push`. Do not attempt to grep a shell variable — the value is in the conversation history.

**Capture `PR_NUMBER` from the conversation history** (the chained skill prints `PR_NUMBER=<number>` as structured output). Read it from the conversation context, not from a shell variable:

```bash
# PR_NUMBER is captured from the conversation history, not a shell variable.
# The chained skill prints lines like: PR_NUMBER=42 or PR_URL=https://...
# Use grep to find lines matching the pattern, take the last one
PR_NUMBER=$(echo "$CONVERSATION_HISTORY" | grep -oE '^PR_NUMBER=[0-9]+' | tail -1 | cut -d= -f2)
if [ -z "$PR_NUMBER" ]; then
  echo "ERROR: Could not capture PR_NUMBER from commit-push output. Conversation history:"
  echo "$CONVERSATION_HISTORY" | tail -20
  exit 1
fi
echo "PR_NUMBER=$PR_NUMBER"
```

**Note:** `$CONVERSATION_HISTORY` is not a real environment variable. The agent running this skill substitutes the actual conversation text when executing the command. If the conversation history is not available as a shell variable, the agent should read the PR number directly from the conversation context instead of running this grep command.

Write it to a file for later use in Step 12:

```bash
echo "<PR_NUMBER_VALUE>" > "${SESSION_ID}-pr-number.txt"
```

Replace `<PR_NUMBER_VALUE>` with the actual number read from the conversation history.

If `commit-push` fails, report the error and stop. Do not attempt to recover with manual git commands.

**After reading the PR number, continue to Step 7.** Do not stop or wait for further input — the pipeline proceeds automatically.

---

## Step 6.5: Discover Related Tests

Before implementing, read existing tests to understand the project's testing conventions, patterns, and structure. This ensures new tests (if any are required by the tasks) follow the established style.

**Identify source files from the spec:** Look at the tasks in `tasks.md`, the design document, and spec deltas to determine which source files will be created or modified.

**Find related tests using these rules:**

1. **Nested test directory** (most common): If the source file lives in `src/foo/bar.js`, look for `tests/unit/foo/bar.test.js` or `tests/unit/bar.test.test.js`. Mirror the directory structure.
2. **Flat test directory**: If tests live in a flat `tests/` or `tests/unit/` directory with no nesting, find tests by filename matching — e.g., `src/foo/bar.js` → `tests/bar.test.js` or `tests/bar.test.test.js`.
3. **Sibling test file**: Some projects place test files alongside source — e.g., `src/foo/bar.js` with `src/foo/bar.test.js` or `src/foo/bar.spec.js`.
4. **Module-level test**: If no exact match exists, look for a test file that covers the parent module or directory — e.g., `tests/unit/foo.test.js` covering everything in `src/foo/`.

**For each source file being created or modified:**

```bash
# Example: find related tests for src/scheduler/runner.js
# 1. Check nested test directory
ls tests/unit/scheduler/runner.test.js 2>/dev/null && echo "found: tests/unit/scheduler/runner.test.js"

# 2. Check flat test directory by name
ls tests/runner.test.js 2>/dev/null && echo "found: tests/runner.test.js"

# 3. Check sibling test file
ls src/scheduler/runner.test.js 2>/dev/null && echo "found: src/scheduler/runner.test.js"

# 4. Check parent module test
ls tests/unit/scheduler.test.js 2>/dev/null && echo "found: tests/unit/scheduler.test.js"
```

Read every test file you discover. Pay attention to:
- **Assertion style** — `assert`, `chai`, `node --test`, custom helpers
- **Mocking patterns** — how dependencies, external services, and config are mocked
- **Test structure** — `describe`/`it` nesting, fixture setup, teardown
- **Naming conventions** — test file and test case naming
- **Common helpers** — shared test utilities, factories, or fixtures

Write a brief summary of the patterns you found to `${SESSION_ID}-test-patterns.md` (use an example name — the agent decides where to place it). This becomes context for Step 7 when implementing tests.

If no related tests exist, note "No existing tests found — follow project conventions from AGENTS.md §3.5" and proceed.

---

## Step 7: Apply Tasks (via openspec-apply-change)

Invoke the `openspec-apply-change` skill to implement all tasks from `tasks.md`.

The `openspec-apply-change` skill will:
- Read the tasks from `tasks.md`
- Implement each task sequentially
- Mark tasks complete as `[x]` in `tasks.md`
- Report progress as "N/M tasks complete"

**Wait for the skill to complete.** Do not proceed to Step 7.5 until all tasks are marked complete.

If the skill reports that tasks are blocked (missing artifacts), report the error and stop. Do not proceed with incomplete work.

**If interrupted (timeout, context limit):** Re-invoke `openspec-apply-change "$CHANGE_NAME"` to resume from where it left off. The skill checks task status and only implements remaining tasks.

After completion, verify:
- All tasks in `tasks.md` are marked `[x]`

**After verification, continue to Step 7.5.** Do not stop or wait for further input — the pipeline proceeds automatically.

**Check which npm scripts are available before running them** — not all projects define the same scripts:

```bash
AVAILABLE_SCRIPTS=$(node -e "console.log(Object.keys(require('./package.json').scripts || {}).join('\n'))" 2>/dev/null)
```

- If `test` script exists, run: `npm run test`
- If `lint` script exists, run: `npm run lint`
- If `coverage` script exists, run: `npm run coverage`
- If no script exists in package.json, skip the step and note "No script defined — skipped."

If any verification fails, fix the issues and re-verify.

---

## Step 7.5: Commit & Push Implementation Code (via commit-push)

**Purpose:** Push the code produced by `openspec-apply-change` to the open PR.

Invoke the `commit-push` skill to stage, commit, push, and update the existing PR.

This will:
- Stage all implementation files (not openspec files — they are already committed)
- Commit using conventional commit format from the scanned project rules §5.1
- Push to the remote
- Update the existing PR (created in Step 6) if `commit-push` detects a pre-existing PR
- Print structured output: `PR_NUMBER=<number>` and `PR_URL=<url>`

Read the `PR_NUMBER` from the structured output. If `commit-push` fails, report the error and stop. Do not attempt to recover with manual git commands.

**Capture `PR_NUMBER` from the conversation history** (the chained skill prints `PR_NUMBER=<number>` as structured output). Read it from the conversation context, not from a shell variable:

```bash
# PR_NUMBER is captured from the conversation history, not a shell variable.
PR_NUMBER=$(echo "$CONVERSATION_HISTORY" | grep -oE '^PR_NUMBER=[0-9]+' | tail -1 | cut -d= -f2)
if [ -z "$PR_NUMBER" ]; then
  echo "ERROR: Could not capture PR_NUMBER from commit-push output."
  exit 1
fi
echo "PR_NUMBER=$PR_NUMBER"
```

**Note:** `$CONVERSATION_HISTORY` is not a real environment variable. The agent substitutes the actual conversation text when executing the command. If the conversation history is not available as a shell variable, read the PR number directly from the conversation context instead.

**After `/commit-push` completes, continue to Step 8.** Do not stop or wait for further input — the pipeline proceeds automatically.

---

## Step 8: Verify Application Starts (`npm start`)

After tasks are applied, verify the application actually starts without crashing.

**Run with a timeout** — use a portable approach that works on both GNU and BSD:

```bash
# Portable timeout: use Perl if available, otherwise background + sleep + kill
if command -v timeout >/dev/null 2>&1; then
  timeout 10 npm start 2>&1 || true
else
  npm start &
  NPM_PID=$!
  sleep 10
  kill $NPM_PID 2>/dev/null || true
  wait $NPM_PID 2>/dev/null || true
fi
```

If the application fails to start, fix the issue before proceeding. Do not skip this step — a crashing application means the implementation is flawed.

---

## Step 9: Audit Results Against Specs & Goals (Up to 3 Iterations)

Read the original goals from the file named `${SESSION_ID}-feature-goals.md` (use an example name — the agent decides where to place it) and the spec documents. Audit the implemented results:

1. **Goal fulfillment:** Does the implementation satisfy every detailed goal?
2. **Spec compliance:** Does the code match the requirements in the spec documents?
3. **Task completion:** Were all tasks in tasks.md actually implemented correctly?
4. **Quality check:** Are there any obvious issues, missing edge cases, or inconsistencies?

Write audit findings to the file named `${SESSION_ID}-audit-results.md` (use an example name — the agent decides where to place it) (overwrite previous results).

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to decide whether errors remain before iterating. Pass the audit findings as state.

```
Question: "Does the implementation satisfy every goal with no errors?"
Type: noul
Criteria:
  false = missing goals, spec violations, incomplete tasks, or quality issues
  true  = all goals fulfilled, spec-compliant, tasks complete, no obvious issues
Example answer: false
```

**Important:** The `noul` type returns a *single float in [0,1]*, not a label — it is the probability of `true`. Interpret it as: `≥ 0.6` → true (no errors, proceed), `≤ 0.4` → false (errors remain, iterate), between → unknown. Fall back to manual review if no decision tool is available.

**If errors are found:**
- Fix the code to address each finding
- Re-verify tests and lint pass
- Re-audit (increment iteration count)
- Repeat until no errors remain or 3 iterations are exhausted

**If no errors are found:**
- Proceed to Step 10

---

## Step 10: Archive and Push (openspec-archive-change → commit-push)

**Purpose:** Archive the OpenSpec change and push the archive (and any remaining implementation fixes from Step 9) to the open PR.

1. **Archive the OpenSpec change with automatic sync:**

    1. **Archive with retry on validation failure** (up to 3 attempts):

        ```bash
        ARCHIVE_ATTEMPTS=0
        ARCHIVE_MAX=3
        while [ $ARCHIVE_ATTEMPTS -lt $ARCHIVE_MAX ]; do
          ARCHIVE_ATTEMPTS=$((ARCHIVE_ATTEMPTS + 1))
          echo "Archive attempt $ARCHIVE_ATTEMPTS/$ARCHIVE_MAX..."

          ARCHIVE_OUTPUT=$(openspec archive "$CHANGE_NAME" --yes 2>&1)
          ARCHIVE_EXIT=$?

          if [ $ARCHIVE_EXIT -eq 0 ]; then
            echo "$ARCHIVE_OUTPUT" > "${SESSION_ID}-archive-output.md"
            echo "Archive succeeded on attempt $ARCHIVE_ATTEMPTS."
            break
          fi

          echo "Archive failed (attempt $ARCHIVE_ATTEMPTS): $ARCHIVE_OUTPUT"
          echo "$ARCHIVE_OUTPUT" > "${SESSION_ID}-archive-error.md"

          if [ $ARCHIVE_ATTEMPTS -ge $ARCHIVE_MAX ]; then
            echo "ERROR: Archive failed after $ARCHIVE_MAX attempts. Stopping."
            exit 1
          fi
        done
        ```

    2. **When presented with a sync prompt**, automatically choose **sync** (the recommended option). Do not require user input — just select sync:
        - If the prompt shows "Sync now (recommended)" / "Archive without syncing" → choose "Sync now (recommended)"
        - If the prompt shows "Archive now" / "Sync anyway" / "Cancel" → choose "Archive now"
        - If no delta specs exist → proceed without sync prompt

    3. **Resolve spec issues if archive validation failed** (up to 3 fix iterations):

        If the archive step above exited with an error (i.e., `openspec archive` returned non-zero and the loop terminated via `exit 1`), the file `${SESSION_ID}-archive-error.md` contains the error details. Use those details to identify and fix the underlying spec issues:

        - Read `${SESSION_ID}-archive-error.md` to understand what validation failed (missing requirements, inconsistent specs, task-to-spec mismatches, etc.)
        - Fix the relevant spec documents (proposal.md, design.md, tasks.md, and any spec deltas in `specs/`)
        - Update tasks.md if task-to-spec mapping is broken
        - Re-run the archive attempt (go back to step 1 above)
        - Repeat until archive succeeds or 3 fix iterations are exhausted

        **If archive still fails after 3 fix iterations**, report the remaining validation errors and stop. Do not proceed with an unarchived change.

    4. **Verify** the archive was created:
        ```bash
        ls openspec/changes/archive/
        ```

    The change directory should now be under `openspec/changes/archive/YYYY-MM-DD-<name>/`.

2. **Push the archive (and all remaining changes) to the open PR** by invoking `commit-push`.

    This will:
    - Stage the archived change directory and any delta specs synced from the archive
    - Stage any remaining implementation fixes from Step 9
    - Commit using conventional commit format from the scanned project rules §5.1
    - Push to the remote
    - Update the existing PR (created in Step 6) if `commit-push` detects a pre-existing PR
    - Print structured output: `PR_NUMBER=<number>` and `PR_URL=<url>`

    Read the `PR_NUMBER` from the structured output. If `commit-push` fails, report the error and stop. Do not attempt to recover with manual git commands.

    Add a reusable capture pattern to extract `PR_NUMBER` from the conversation history after `commit-push` completes:

    ```bash
    # Capture PR_NUMBER from the conversation history (last occurrence wins)
    PR_NUMBER=$(echo "$CONVERSATION_HISTORY" | grep -oE '^PR_NUMBER=[0-9]+' | tail -1 | cut -d= -f2)
    if [ -z "$PR_NUMBER" ]; then
      echo "ERROR: Could not capture PR_NUMBER from commit-push output."
      exit 1
    fi
    echo "PR_NUMBER=$PR_NUMBER"
    ```

**After the archive and push complete, continue to Step 11.** Do not stop or wait for further input — the pipeline proceeds automatically.

---

## Step 11: Update PR Title & Description (via update-pr)

**Purpose:** Set the final, accurate PR title and description reflecting what was actually implemented.

Invoke the `update-pr` skill to update the PR. This skill scans project rules for conventions and the PR template, synthesizes both from the delta between the branch and target, and applies changes via `gh api`.

The `update-pr` skill will:
- Gather the actual changes made (`git diff main...HEAD --stat`, `git diff main...HEAD --name-only`)
- Synthesize a final PR description that reflects what was actually implemented, references specific files and modules changed, notes any deviations from the original plan, and includes a testing coverage summary
- Follow the PR template format from the scanned project rules §5.4
- Update the PR using `gh api`

After `update-pr` completes, verify the PR was updated correctly by checking the PR on GitHub.

Add a reusable capture pattern to confirm `PR_NUMBER` is still available from the conversation history after `update-pr` completes:

```bash
# PR_NUMBER was already captured from earlier commit-push steps.
# Re-capture to confirm it's still available after update-pr.
PR_NUMBER=$(echo "$CONVERSATION_HISTORY" | grep -oE '^PR_NUMBER=[0-9]+' | tail -1 | cut -d= -f2)
if [ -z "$PR_NUMBER" ]; then
  echo "ERROR: PR_NUMBER not found in conversation history after update-pr."
  exit 1
fi
echo "PR_NUMBER=$PR_NUMBER (verified after update-pr)"
```

**After verification, continue to Step 12.** Do not stop or wait for further input — the pipeline proceeds automatically.

---

## Step 12: Post Audit Results as PR Comment

Post the final audit results from Step 9 as a comment on the PR:

```bash
PR_NUMBER=$(cat "${SESSION_ID}-pr-number.txt")
gh pr comment "$PR_NUMBER" --body "$(cat "${SESSION_ID}-audit-results.md")" --repo "$GH_REPO"
```

---

## Step 13: Final Report

Print a summary:

```
Feature lifecycle complete.
Change: $CHANGE_NAME
PR: <URL>
Goals addressed: <count>/<total>
Iterations: <spec-audit-x>, <impl-audit-y>
Tests: passing
Lint: passing
Coverage: maintained
```

---

## Step 14: Cleanup

Cleanup is the agent's responsibility. When the task completes, or when cleaning up after a failure or interruption, remove the worktree and all temp files as described in Step 0.75. Do not rely on a shell `trap` — explicitly clean up work files at the end of the task or during failure cleanup.

Verify the worktree was removed:
```bash
ls "$WORKTREE_PATH" 2>&1 || echo "Worktree cleaned up successfully."
```

---

## Error Handling

- If any step fails, report the error clearly and stop. Do not continue with incomplete work.
- If 3 audit iterations are exhausted and errors remain, report the remaining issues and stop.
- If `gh` API calls fail, report the error and provide the manual commands needed.
- Always leave the repository in a clean state (working tree clean, on the feature branch).

## Gotchas

- **Session IDs prevent collisions.** When running multiple instances (e.g., subagents), always use a unique `SESSION_ID` to avoid temp file collisions.
- **`commit-push` is delegated, not inline.** Steps 6, 7.5, and 10 invoke `commit-push` as a chain instruction — do not perform git operations inline at those steps.
- **The pipeline is non-blocking.** After each delegated skill completes, the pipeline proceeds automatically. Do not wait for user confirmation between steps.
- **`openspec-apply-change` is resumable.** If interrupted by timeout or context limit, re-invoke with the same `CHANGE_NAME` to resume from where it left off.
left off.
