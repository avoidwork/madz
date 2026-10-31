---
name: update-semver
description: Audits the delta between HEAD and the tag matching the current package.json version, decides if it's a major/minor/patch bump, updates package.json, runs npm i and npm run changelog, then triggers commit-push, enables auto-merge on the PR, and announces the new version. Does NOT create a git tag — that is handled by the separate git-tag skill after the PR merges.
license: BSD 3-Clause
compatibility: Requires Node.js 24+, npm, git CLI with remote access, gh CLI for PR management, and git worktree support. Must be run from the project root directory containing package.json.
metadata:
  agent: coding
---

# Update Semver

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

You are the release conductor. The version number is the promise you make to the world. Treat it with precision. Follow these steps in order.

## Step 1: Ensure Clean State & Create Isolated Worktree

Before touching any files, create a dedicated git worktree so the release work is isolated from the main working tree. This keeps `main` pristine and gives the PR a clear home.

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

**Capture a unique session identifier** so that multiple instances (e.g., subagents) can run in parallel without file collisions:

```bash
# Portable: works in Alpine, minimal images, and standard Linux
# Generates 8 random hex chars from /dev/urandom, falls back to $RANDOM if unavailable
SESSION_ID=$(head -c 8 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n' || echo $RANDOM$RANDOM$RANDOM)
echo "SESSION_ID=$SESSION_ID"
```

**Create the isolated worktree from `main`:**

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

**Cleanup:** When the task completes, or when cleaning up after a failure or interruption, the agent must remove the worktree. Do not rely on a shell `trap` — explicitly clean up work files at the end of the task or during failure cleanup. Remove the worktree with `git worktree remove "$WORKTREE_PATH" --force` (falling back to `rm -rf "$WORKTREE_PATH"` if needed) and return to `$ORIGINAL_DIR`.

## Step 1.5: Create a Release Branch

Create a deterministic branch for this release inside the worktree. This gives the PR a clear home.

```bash
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BRANCH="chore/update-semver-${TIMESTAMP}"
git checkout -b "$BRANCH"
echo "Branch: $BRANCH"
```

The timestamp uses ISO 8601 format in UTC. Colons are replaced with dashes (`%H-%M-%S` instead of `%H:%M:%S`) to ensure filesystem compatibility.

## Step 2: Read the Current Version

Extract the version from `package.json` using `jq` for precision:

```bash
CURRENT_VERSION=$(jq -r '.version' package.json)
echo "CURRENT_VERSION=$CURRENT_VERSION"
```

If `jq` is unavailable, fall back to `grep`:

```bash
CURRENT_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
echo "CURRENT_VERSION=$CURRENT_VERSION"
```

## Step 3: Find the Last Tag

The tag to compare against is the most recent tag on the current branch — the actual last release.

```bash
TARGET_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
echo "TARGET_TAG=$TARGET_TAG"
```

If no tag exists, set `TARGET_TAG=""` and use the entire history as the delta.

## Step 4: Audit the Delta

Collect commit messages between the target tag and HEAD:

```bash
if [ -n "$TARGET_TAG" ]; then
  COMMITS=$(git log --pretty=format:"%s" "${TARGET_TAG}..HEAD")
else
  COMMITS=$(git log --pretty=format:"%s" --max-count=50)
fi
echo "COMMITS=$COMMITS"
```

## Step 5: Decide the Bump

Analyze the commit messages using **Conventional Commits** semantics. Apply the **highest** bump found, accounting for reverts:

| Commit prefix | Bump |
|---|---|
| `feat:` | **minor** |
| `fix:` | **patch** |
| `BREAKING CHANGE` or `!` after type/scope | **major** |
| `perf:` | **minor** (performance improvements are treated as features) |
| `refactor:`, `chore:`, `docs:`, `style:`, `test:` | **no bump** |
| `Revert "feat: ..."` | **cancels** the corresponding `feat:` |
| `Revert "fix: ..."` | **cancels** the corresponding `fix:` |

**Decision rules:**
1. Count `feat:` commits and `Revert "feat: ..."` commits. Net features = feat count minus revert count.
2. Count `fix:` commits and `Revert "fix: ..."` commits. Net fixes = fix count minus revert count.
3. If net features > 0 → **minor**
4. If net fixes > 0 (and no net features) → **patch**
5. If no version-relevant commits but commits exist → **patch** (maintenance release)
6. If no commits at all → **abort** (nothing to release)

Implement the counting and bump decision:

```bash
# Count commit types (excluding merge commits and reverts)
# Patterns match both "type:" and "type(scope):" conventional commit formats
FEAT_COUNT=$(echo "$COMMITS" | grep -cE "^feat(\(|:)" || true)
FIX_COUNT=$(echo "$COMMITS" | grep -cE "^fix(\(|:)" || true)
PERF_COUNT=$(echo "$COMMITS" | grep -cE "^perf(\(|:)" || true)
BREAKING_COUNT=$(echo "$COMMITS" | grep -cE "(BREAKING CHANGE|!:)" || true)
REVERT_FEAT_COUNT=$(echo "$COMMITS" | grep -cE '^Revert "feat' || true)
REVERT_FIX_COUNT=$(echo "$COMMITS" | grep -cE '^Revert "fix' || true)

# Net counts after reverts
NET_FEAT=$((FEAT_COUNT - REVERT_FEAT_COUNT))
NET_FIX=$((FIX_COUNT - REVERT_FIX_COUNT))

# Determine bump
if [ "$BREAKING_COUNT" -gt 0 ]; then
  BUMP="major"
  REASON="$BREAKING_COUNT breaking change(s)"
elif [ "$NET_FEAT" -gt 0 ] || [ "$PERF_COUNT" -gt 0 ]; then
  BUMP="minor"
  REASON="$NET_FEAT unreverted feat(s)"
elif [ "$NET_FIX" -gt 0 ]; then
  BUMP="patch"
  REASON="$NET_FIX unreverted fix(es)"
elif [ -n "$COMMITS" ]; then
  BUMP="patch"
  REASON="no version-relevant commits ($(echo "$COMMITS" | wc -l) commits)"
else
  echo "No commits to release. Aborting."
  exit 1
fi

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to pick the bump instead of reasoning it out manually. Feed the commit delta as state.

```
Question: "What semver bump should this release get?"
Type: choice
Options: major, minor, patch, none
Criteria:
  major = BREAKING CHANGE or `!` after type/scope
  minor = net feat > 0 or perf commits
  patch = net fix > 0 or no version-relevant commits
  none  = no commits at all
Example answer: minor
```

Interpret the returned label directly. Fall back to the counting rules above if no decision tool is available.

# Compute new version using POSIX-compatible field splitting
MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)
case "$BUMP" in
  major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
  minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
  patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
esac

echo "Bump: $BUMP ($REASON)"
echo "Version: $CURRENT_VERSION → $NEW_VERSION"
echo "NEW_VERSION=$NEW_VERSION"
echo "BUMP=$BUMP"
```

## Step 6: Update package.json

Replace the version in `package.json` with the new semver value. Use `jq` for precision:

```bash
jq --arg v "<NEW_VERSION>" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
```

If `jq` is unavailable, fall back to `sed` — but verify there's only one version field:

```bash
VERSION_COUNT=$(grep -c '"version"' package.json)
if [ "$VERSION_COUNT" -ne 1 ]; then
  echo "ERROR: Found $VERSION_COUNT version fields in package.json. Cannot proceed safely."
  exit 1
fi
sed 's/"version": "[^"]*"/"version": "<NEW_VERSION>"/' package.json > package.json.tmp && mv package.json.tmp package.json
```

Verify the change:
```bash
jq -r '.version' package.json
```

## Step 7: Install, Build, and Generate Changelog

```bash
npm i --ignore-scripts
if [ $? -ne 0 ]; then
  echo "ERROR: npm install failed. Aborting."
  exit 1
fi

# Run build if the script exists — MUST succeed if present
if jq -e '.scripts.build' package.json > /dev/null 2>&1; then
  echo "Build script detected. Running build..."
  npm run build
  if [ $? -ne 0 ]; then
    echo "ERROR: Build script failed. Aborting — cannot release a broken build."
    exit 1
  fi
  echo "Build succeeded."
fi

npm run changelog
if [ $? -ne 0 ]; then
  echo "WARNING: npm run changelog failed. Continuing without changelog update."
fi
```

This installs dependencies (ensuring lockfile is current), runs `build` if the project has one (**must succeed** if present — a broken build is a broken release), and generates an updated `CHANGELOG.md` using `auto-changelog`. The `--ignore-scripts` flag prevents postinstall scripts from running during the version bump. If `npm i` fails, abort immediately — do not proceed to commit a broken state.

## Step 8: Trigger commit-push

Delegating version release to `commit-push`, which will:
1. Scan for AGENTS.md to read project rules
2. Stage **all** files (`git add -A` — nothing left behind)
3. Commit with a conventional commit message (e.g., `chore: release v1.3.8`)
4. Push to the remote
5. Open a PR targeting `main`

Invoke the `commit-push` skill.

**After `commit-push` completes, continue to Step 9.** Do not stop or wait for further input — the pipeline proceeds automatically.

Add a reusable capture pattern to extract `PR_NUMBER` from the conversation history after `commit-push` completes:

```bash
# Capture PR_NUMBER from the conversation history (last occurrence wins)
PR_NUMBER=$(echo "$CONVERSATION_HISTORY" | sed -n 's/^PR_NUMBER=\([0-9]\{1,\}\)$/\1/p' | tail -1)
if [ -z "$PR_NUMBER" ]; then
  echo "ERROR: Could not capture PR_NUMBER from commit-push output."
  exit 1
fi
echo "PR_NUMBER=$PR_NUMBER"
```

## Step 9: Enable Auto-Merge

After the PR is created, enable auto-merge on it with **squash** merge. Extract the PR number from the `commit-push` output (look for `PR_NUMBER=<number>` printed as structured output), then enable auto-merge:

```bash
gh pr merge "$PR_NUMBER" --auto --squash
echo "Auto-merge: ENABLED (squash)"

# Verify auto-merge was enabled successfully
AUTO_MERGE=$(gh pr view "$PR_NUMBER" --json autoMerge --jq '.enabled' 2>/dev/null || true)
if [ "$AUTO_MERGE" != "true" ]; then
  echo "WARNING: Auto-merge may not be enabled for PR #$PR_NUMBER (state: $AUTO_MERGE)."
else
  echo "Auto-merge verified for PR #$PR_NUMBER."
fi
```

If auto-merge fails (e.g., repo settings don't support it), report the error and advise manual merge.

## Step 10: Announce the New Version

Print a final announcement:

```
Version <NEW_VERSION> is live.

Branch: <branch-name>
PR: <PR_URL>
Bump: <type> (<count> commits analyzed)
From: <TARGET_TAG or "initial">
Changelog: updated

The world gets a new version.
```

## Examples

```
User: update-semver

Agent: Creating release branch: chore/update-semver-2026-08-15T10-30-00Z
Current version: 1.34.0
Last tag: 1.34.0
Delta: 12 commits

Bump: minor (3 feat: commits found)
Version: 1.34.0 → 1.35.0

Updated package.json to 1.35.0
npm install: success
Build: success
Changelog: updated

commit-push: PR #456 created
Auto-merge: ENABLED (squash)

Version 1.35.0 is live.

Branch: chore/update-semver-2026-08-15T10-30-00Z
PR: https://github.com/avoidwork/madz/pull/456
Bump: minor (3 commits analyzed)
From: 1.34.0
Changelog: updated

The world gets a new version.
```

## Gotchas

- **Worktree isolation.** All release work happens in an isolated worktree created in Step 1. The worktree is a sibling of the repo root (e.g., `madz.worktrees/<SESSION_ID>/`), not nested inside it — this avoids the nested-repo footgun and keeps `main` pristine.
- **Cleanup is the agent's responsibility.** When the task completes, or when cleaning up after a failure or interruption, remove the worktree as described in Step 1. Do not rely on a shell `trap` — explicitly clean up work files at the end of the task or during failure cleanup.
- **Session IDs prevent collisions.** When running multiple instances (e.g., subagents), always use a unique `SESSION_ID` to avoid worktree path collisions.
- **`commit-push` is delegated, not inline.** Step 8 invokes `commit-push` as a chain instruction — do not perform git operations inline at that step.
- **Never commit directly to `main`.** The release branch is created inside the worktree in Step 1.5; `main` is never modified directly.

---
