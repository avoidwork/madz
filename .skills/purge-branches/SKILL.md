---
name: purge-branches
description: Deletes all local git branches except 'main'. Works in any git repository — no npm or package.json dependency.
license: BSD 3-Clause
compatibility: Requires git CLI. Must be run from a git repository root.
metadata:
  agent: coding
---

# Purge Branches

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Delete all local branches except `main`. Pure git — no npm, no package.json required.

## Pre-flight Check

Check current state and confirm we're not on a branch that will be deleted:

```bash
# Check current branch
CURRENT_BRANCH=$(git branch --show-current)

# Handle detached HEAD
if [ -z "$CURRENT_BRANCH" ]; then
  echo "ERROR: You are in detached HEAD state. Switch to a branch before purging."
  echo "  git checkout main"
  exit 1
fi

echo "Current branch: $CURRENT_BRANCH"

# Warn if not on main — current branch cannot be deleted
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "WARNING: You are on '$CURRENT_BRANCH', not 'main'. The current branch will be skipped."
fi

# Show branches that will be deleted
echo ""
echo "Branches that will be deleted:"
git branch --format='%(refname:short)' | grep -v '^main$' | grep -v "^${CURRENT_BRANCH}$"
BRANCH_COUNT=$(git branch --format='%(refname:short)' | grep -v '^main$' | grep -vc "^${CURRENT_BRANCH}$")
echo ""
echo "Total: $BRANCH_COUNT branches to delete"

if [ "$BRANCH_COUNT" -eq 0 ]; then
  echo "No branches to purge."
  exit 0
fi
```

## Execute

Delete all branches except `main`:

```bash
# Delete all branches except main and current (safely, one at a time)
git branch --format='%(refname:short)' | grep -v '^main$' | grep -v "^${CURRENT_BRANCH}$" | while read -r branch; do
  if git branch -D "$branch" 2>&1; then
    echo "Deleted: $branch"
  else
    echo "Skipped: $branch (delete failed)"
  fi
done
```

**Handle failure:** If any branch fails to delete (e.g., it's checked out), the loop continues — only successfully deleted branches are counted. Report any failures at the end.

## Report

```bash
# Count remaining branches (excluding main and current)
REMAINING=$(git branch --format='%(refname:short)' | grep -v '^main$' | grep -vc "^${CURRENT_BRANCH}$")
echo ""
echo "Purge complete."
echo "Remaining branches: $REMAINING"
```

## Examples

```
User: purge-branches

Agent: Checking current branch: feature/add-auth
Branches that will be deleted:
feature/add-auth
fix/typo-in-readme
chore/update-deps

Total: 3 branches to delete

Deleted: feature/add-auth
Deleted: fix/typo-in-readme
Deleted: chore/update-deps

Purge complete.
Remaining branches: 0
```

## Gotchas

- **The current branch is safe.** The skill only deletes branches other than `main`. If you're on `main`, no branches are deleted.
- **Force delete (`-D`) is used.** Branches that haven't been merged are deleted without checking merge status. Verify you don't need a branch before running.
- **Cannot undo.** Once deleted, local branches are gone. Use `git reflog` to recover if needed, but this is not guaranteed.

---
