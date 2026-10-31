---
name: scan-issues
description: Scans GitHub for open issues labeled 'approved' (excluding those also labeled 'in progress'), processes them via fix-issue, opens PRs with auto-merge, and resolves merge conflicts. Runs hourly.
license: BSD 3-Clause
compatibility: Requires gh CLI authenticated with a GitHub repo. Must be run from a git project root.
metadata:
  agent: coding
---

# Scan & Fix Issues

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

An autonomous issue scanner and fixer. Finds approved, unassigned issues and processes them through the `fix-issue` pipeline. Worktree isolation is handled internally by `create-feature`.

## Workflow

### 1. Determine Repository

Capture the project root and extract the repo from the git remote — never hardcode paths:

```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
if [ -z "$GIT_REMOTE" ]; then
  echo "ERROR: No git remote 'origin' found. Can't determine repository."
  exit 1
fi

if echo "$GIT_REMOTE" | grep -q '^git@'; then
  REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)\.git$/\1/')
  if [ -z "$REPO" ]; then
    REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)$/\1/')
  fi
elif echo "$GIT_REMOTE" | grep -q 'github\.com'; then
  REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)\.git$/\1/')
  if [ -z "$REPO" ]; then
    REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)$/\1/')
  fi
else
  echo "ERROR: Could not parse repository from remote '$GIT_REMOTE'."
  exit 1
fi

# Validate REPO is non-empty and contains a slash (owner/repo format)
if [ -z "$REPO" ] || ! echo "$REPO" | grep -q '/'; then
  echo "ERROR: Parsed repository '$REPO' does not look like 'owner/repo'. Check remote URL."
  exit 1
fi
```

### 2. Scan for Issues

```bash
gh issue list --state open --label approved --search '-label:"in progress"' --json number,title,url,labels --repo "$REPO"
```

This pushes the filtering to the GitHub API — only issues with `approved` but **not** `in progress` are returned. No client-side `jq` filtering needed.

If no issues match, report `No approved, unassigned issues found.` and exit cleanly.

### 3. Parse Results

Extract each issue's `number`, `title`, `url`, and `labels` from the JSON array.

### 4. Process Issues

**Process each issue independently.** Issues can be processed in parallel — spawn subagents or dispatch concurrent `fix-issue` runs. Worktree isolation is handled internally by `create-feature`, so parallel runs do not conflict:

For each issue:

1. **Invoke fix-issue** as a chain instruction.
   This chains through the full `fix-issue` → `create-feature` pipeline. The `create-feature` skill handles worktree creation and cleanup internally.

2. **Wait for completion.** Each `fix-issue` run completes on its own; parallel runs proceed independently.

3. **Extract PR_NUMBER from fix-issue output.** The `fix-issue` chain prints `PR_NUMBER=<number>` as structured output in the conversation history. Read it from there — do not attempt to grep a shell variable.

   Add a reusable capture pattern to extract `PR_NUMBER` from the conversation history after `fix-issue` completes:

   ```bash
   # Capture PR_NUMBER from the conversation history (last occurrence wins)
   PR_NUMBER=$(echo "$CONVERSATION_HISTORY" | sed -n 's/^PR_NUMBER=\([0-9]\{1,\}\)$/\1/p' | tail -1)
   if [ -z "$PR_NUMBER" ]; then
     echo "WARNING: Could not capture PR_NUMBER from fix-issue output. Issue may have been skipped."
   else
     echo "PR_NUMBER=$PR_NUMBER"
   fi
   ```

   If `PR_NUMBER` is empty, the issue was skipped or the pipeline didn't create a PR — log it and continue.

4. **If fix-issue succeeds:** Log the issue number and PR number.

5. **If fix-issue fails:** Log the error, skip the issue, and continue with the next. Never abort the queue over a single failure.

**Rate limiting:** If GitHub API returns 403 rate limit, wait 60 seconds and retry the current issue once.

**Timeout handling:** Each fix-issue run can take 30-60 minutes (via create-feature). If a run exceeds 60 minutes, report a timeout warning but do not abort — the issue may still be processing.

### 6. PR Auto-Merge

The `create-feature` → `commit-push` pipeline within `fix-issue` handles PR creation. After extracting `PR_NUMBER` from the fix-issue output:

- Set it to auto-merge if the repo supports it:
  ```bash
  gh pr merge "$PR_NUMBER" --auto --merge --repo "$REPO"

  # Verify auto-merge was enabled successfully
  AUTO_MERGE=$(gh pr view "$PR_NUMBER" --json autoMerge --jq '.enabled' --repo "$REPO" 2>/dev/null || true)
  if [ "$AUTO_MERGE" != "true" ]; then
    echo "WARNING: Auto-merge may not be enabled for PR #$PR_NUMBER (state: $AUTO_MERGE)."
  else
    echo "Auto-merge verified for PR #$PR_NUMBER."
  fi
  ```
- If auto-merge is not available or fails, note it in the report but do not block on it.

### 7. Resolve Merge Conflicts

If a PR cannot merge because it conflicts with the default branch, resolve the conflict in an **isolated worktree** so parallel runs do not collide on the shared checkout. Each conflict resolution uses its own session ID and worktree path (same pattern as `create-feature`).

1. **Detect the conflict.** Check the PR's mergeable state:
   ```bash
   MERGEABLE=$(gh pr view "$PR_NUMBER" --json mergeable --jq '.mergeable' --repo "$REPO")
   if [ "$MERGEABLE" = "CONFLICTING" ]; then
     echo "PR #$PR_NUMBER has merge conflicts. Resolving..."
   fi
   ```

2. **Create an isolated worktree for the PR branch.** Use a unique session ID and a sibling directory so parallel runs never share a checkout:
   ```bash
   PROJECT_ROOT=$(git rev-parse --show-toplevel)
   WORKTREES_DIR="$(dirname "$PROJECT_ROOT")/$(basename "$PROJECT_ROOT").worktrees"
   mkdir -p "$WORKTREES_DIR"
   SESSION_ID=$(head -c 8 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || echo $RANDOM$RANDOM$RANDOM)
   WORKTREE_PATH="${WORKTREES_DIR}/conflict-${SESSION_ID}"
   DEFAULT_BRANCH=$(git remote show origin | sed -n 's/.*HEAD branch: //p')
   PR_BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName' --repo "$REPO")

   git fetch origin "$PR_BRANCH" "$DEFAULT_BRANCH"
   git worktree add "$WORKTREE_PATH" "origin/$PR_BRANCH"
   cd "$WORKTREE_PATH"
   ```

3. **Merge the default branch into the PR branch.** Use `--no-commit` so the merge is staged but not committed, letting the same commit step handle both the clean and conflicted cases:
   ```bash
   git merge --no-commit "origin/$DEFAULT_BRANCH"
   ```

4. **Resolve conflicts.** If the merge reports conflicts, resolve them manually:
   - Inspect each conflicted file: `git status` lists them.
   - Edit each file to keep the correct changes, removing conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Stage the resolved files: `git add <file>`.

5. **Commit and push.** Once the merge is complete (clean or resolved) and staged:
   ```bash
   git commit --no-edit
   git push origin "HEAD:refs/heads/$PR_BRANCH"
   ```

6. **Verify.** Confirm the PR is now mergeable:
   ```bash
   gh pr view "$PR_NUMBER" --json mergeable --jq '.mergeable' --repo "$REPO"
   ```
   If it reports `MERGEABLE`, the PR can merge. If it still reports `CONFLICTING`, repeat the resolution steps or report the unresolved conflict.

7. **Clean up the worktree.** Return to the original directory and remove the worktree:
   ```bash
   cd "$PROJECT_ROOT"
   git worktree remove "$WORKTREE_PATH" --force
   ```

**Note:** Each conflict resolution runs in its own worktree with its own session ID, so parallel runs never share a checkout and never collide on the same branch. If the PR branch is already up to date with the default branch (no merge needed), `git merge --no-commit` reports "Already up to date" — skip the commit and push, then clean up.

### 8. Report

After all issues are processed, produce a structured summary:

```
Scan complete.
✅ Fixed: #42 — "Crash on empty input" (PR #101, auto-merged)
✅ Fixed: #57 — "Missing error boundary" (PR #102, auto-merged)
❌ Skipped: #89 — "Auth timeout race" (fix-issue failed)

Total scanned: 3
Success: 2
Failed: 1
```

## Error Handling

- **No `gh` auth:** Suggest `gh auth login`.
- **API rate limit:** Wait 60 seconds, retry once. If it fails again, report the rate limit and stop.
- **Network error:** Retry once, then report.
- **fix-issue failure on individual issue:** Log it, skip it, continue with the next. Never abort the entire queue over a single failure.

## Cron Schedule

This skill is designed to run hourly. When triggered via cron, execute the full workflow above without requiring user input.

## Examples

```
User: scan-issues

Agent: Determining repository... avoidwork/madz
Scanning for approved issues...
Found 3 approved, unassigned issues.

Processing issue #42 — "Crash on empty input"...
  Invoking fix-issue...
  PR created: #101
  Auto-merge: ENABLED

Processing issue #57 — "Missing error boundary"...
  Invoking fix-issue...
  PR created: #102
  Auto-merge: ENABLED

Processing issue #89 — "Auth timeout race"...
  Invoking fix-issue...
  fix-issue failed: gh auth not configured

Scan complete.
✅ Fixed: #42 — "Crash on empty input" (PR #101, auto-merged)
✅ Fixed: #57 — "Missing error boundary" (PR #102, auto-merged)
❌ Skipped: #89 — "Auth timeout race" (fix-issue failed)

Total scanned: 3
Success: 2
Failed: 1
```

---
