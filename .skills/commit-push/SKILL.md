---
name: commit-push
description: Automates the complete git workflow: scans project rules for conventions, stages all changes, commits, pushes to the remote, and opens a Pull Request. Ensures strict compliance with documentation rules, including rule 5.4.
license: BSD 3-Clause
compatibility: Requires git CLI configured with remote access and PR creation tools (e.g., gh).
metadata:
  agent: coding
---

# Commit & Push

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

You are the final step in the craft. Precision matters. Follow these steps in order.

## 0.5: Capture Issue ID

If the invoking skill provides an issue ID (e.g., from `fix-issue` or `create-feature` chain), read it from the conversation history so the PR body can include a `Closes #<ISSUE_ID>` line.

Look for `ISSUE_ID=<number>` printed as structured output by the invoking skill in the conversation history. If found, set `ISSUE_ID` to that value.

If `ISSUE_ID` is set, the PR body will include `Closes #<ISSUE_ID>` so the source issue auto-closes when the PR merges.

---

## 1. Read the Rules

Before touching a single file, scan the project root and any specified paths for an `AGENTS.md` rules file and read its contents.

- Identify the required commit message format (e.g., Conventional Commits).
- Identify the required PR title/body format (look for patterns like a PR template reference).
- **Crucially:** Locate and strictly follow **Rule 5.4** (Pull Request Templates section). Extract the rules about how PR title and body should be constructed.
- **If Rule 5.4 is not found:** Log a WARN and proceed without it — do not block on missing documentation.

## 2. Check for Detached HEAD

Before doing anything else, verify git is not in a detached HEAD state:

```bash
git branch --show-current
```

If the output is empty (detached HEAD), create a branch from the current commit:

```bash
git checkout -b "detached-fix-$(date -u +%s)"
```

## 3. Create & Checkout a Branch

First, determine the repo dynamically (needed for later PR creation):

```bash
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

# Derive the default assignee from the repo owner
GH_OWNER=$(echo "$GH_REPO" | cut -d/ -f1)
echo "GH_REPO=$GH_REPO"
echo "GH_OWNER=$GH_OWNER"
```

Check if already on a feature branch. If the current branch matches `feat/*`, `fix/*`, `docs/*`, or `chore/*`, skip branch creation and proceed to Step 4:

```bash
CURRENT_BRANCH=$(git branch --show-current)
if echo "$CURRENT_BRANCH" | grep -qE '^(feat|fix|docs|chore)/'; then
  echo "Already on feature branch: $CURRENT_BRANCH. Skipping branch creation."
else
  SYNTHESIZE_BRANCH=true
fi
```

If branch creation is needed (`SYNTHESIZE_BRANCH=true`), synthesize the branch name from the **currently staged files** (or unstaged if none are staged yet):

```bash
# Show staged files
CHANGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)

# If nothing is staged, show all changes (staged + unstaged)
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git diff --name-only 2>/dev/null || true)
fi
```

**Branch name strategy** (in priority order):

1. If `CHANGED_FILES` is empty (no changes), use a generic slug: `feat/no-changes`. Log a warning and proceed to staging.
2. If any file matches `src/<module>/` or `tests/<module>/`, extract `<module>` as the slug.
3. If no module pattern matches, take the first changed file, extract basename, strip directories/extensions/special characters to form the slug.
4. Prepend the appropriate prefix based on the commit type (inferred in Step 1 from the scanned rules, or default to `feat`).

```bash
# Infer COMMIT_TYPE from the rules scanned in Step 1, or default to feat.
COMMIT_TYPE="feat"

# Determine SLUG from CHANGED_FILES
SLUG="no-changes"
if [ -n "$CHANGED_FILES" ]; then
  # Priority 2: Check for src/<module>/ or tests/<module>/ pattern
  SLUG=$(echo "$CHANGED_FILES" | grep -oE '(src|tests)/[^/]+' | sed 's/.*\///' | head -1)

  # Priority 3: Fall back to first file basename
  if [ -z "$SLUG" ]; then
    FIRST_FILE=$(echo "$CHANGED_FILES" | head -1)
    SLUG=$(basename "$FIRST_FILE" | sed 's/\.[^.]*$//' | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
  fi

  # Default to first file if still empty
  if [ -z "$SLUG" ]; then
    SLUG="changes"
  fi
fi

git checkout -b "${COMMIT_TYPE}/${SLUG}"
echo "BRANCH_NAME=${COMMIT_TYPE}/${SLUG}"
```

## 4. Stage Everything

```bash
git add -A
```

Check the status to ensure nothing unexpected is included:

```bash
git status
```

If there are untracked files that shouldn't be committed, exclude them via `.gitignore` and log a warning before proceeding.

**Check for no changes:** If `git status --porcelain` returns nothing after staging, there are no changes to commit. Report this and stop — do not create an empty commit.

## 5. Commit

Craft the commit message based on the commit message format identified in Step 1.

### 5.1 Determining the commit type

- If the rules specify Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, etc.), use the prefix that best matches the bulk of changes.
- For documentation-only changes: `docs:`
- For bug fixes: `fix:`
- For new skills/features: `feat:`
- For maintenance: `chore:`

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to pick the commit type instead of reasoning it out manually. Pass the staged changes as state.

```
Question: "What commit type best matches the bulk of these changes?"
Type: choice
Options: feat, fix, docs, chore, refactor, test
Criteria:
  feat     = new skills/features
  fix      = bug fixes
  docs     = documentation-only changes
  chore    = maintenance
  refactor = refactoring with no behavior change
  test     = test-only changes
Example answer: fix
```

Interpret the returned label directly. Fall back to the rules above if no decision tool is available.

### 5.2 Crafting the message

Keep the subject line under 72 characters. Summarize the change in imperative mood.

```bash
git commit -m "<type>: <subject>"
```

Example:
```bash
git commit -m "docs: correct branch naming in AGENTS.md"
```

If the changes span multiple categories, choose the most impactful one and add a body line for additional clarity:

```bash
git commit -m "<type>: <subject>

Additional context if needed."
```

## 6. Push

Push the branch to the remote — this is the point of the skill.

```bash
git push origin HEAD
```

**Handle push failures:**

| Failure | Action |
|---------|--------|
| Remote not configured | Report error and suggest adding a remote (`git remote add origin <url>`) |
| Permission denied | Report error and suggest checking SSH keys or token permissions |
| Merge conflicts | Report error and suggest rebasing (`git rebase origin/main`) before pushing |
| Other errors | Report error and stop. Do not proceed to PR creation |

## 7. Check for Existing PR

Before creating a new PR, check whether one already exists:

```bash
EXISTING_PR_URL=$(gh pr list --head "$(git branch --show-current)" --base main --state open --json url --jq '.[0].url' 2>/dev/null || true)
```

- **If a URL is returned:** Do **not** create a new PR. Extract the PR number and print it as structured output:
  ```
  PR_NUMBER=<number>
  PR_URL=<url>
  ```
  Then skip to Step 9.

- **If no URL is returned:** Proceed to Step 8.

## 8. Open a Pull Request

**Verify `gh` CLI is authenticated:**

```bash
gh auth status 2>&1
```

If authenticated, continue. If not, report `gh` authentication failure and instruct the user to run `gh auth login`.

### 8.1 Synthesize PR Title

- Follow the commit message format from Step 1 if specific rules exist.
- Use the same type prefix and summary as the commit message.

Example: `docs: correct branch naming in AGENTS.md`

### 8.2 Synthesize PR Body

Pull the PR body from the project's template. The template path is defined by Rule 5.4. The standard location is `.github/PULL_REQUEST_TEMPLATE.md` — try it first. If it does not exist, check `.github/gh-pull_request_template.md`, then `.github/PULL_REQUEST_TEMPLATE.md` in other common variants. If none exist, generate a minimal body from the available context.

```bash
# Try common template locations in order
TEMPLATE_PATHS=(
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/gh-pull_request_template.md"
)

TEMPLATE_FILE=""
for path in "${TEMPLATE_PATHS[@]}"; do
  if [ -f "$path" ]; then
    TEMPLATE_FILE="$path"
    break
  fi
done
```

**If a template file was found** (`TEMPLATE_FILE` is set), read it as the base body and fill in each section with the actual content:

- Replace inline placeholders (e.g., `<fill-in>`, `<!-- ... -->`, `[ ]` checkboxes).
- If the template has no fillable placeholders, append the content as a "Details" section at the end.

**Write the filled-in body to a temp file** — do NOT pass the template file path as the body:

**Cleanup:** Remove `BODY_FILE` once the PR is created, or when cleaning up after a failure. Do not rely on a shell `trap` — delete the temp file explicitly when the task completes.

```bash
BODY_FILE=$(mktemp)

# Capture the commit subject and changed files for substitution
COMMIT_SUBJECT=$(git log -1 --oneline | sed 's/^[a-f0-9]* //')
# Handle root commit (no parent) gracefully
if git rev-parse HEAD~1 >/dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only HEAD~1 | head -5 | tr '\n' ', ' | sed 's/,$//')
else
  CHANGED_FILES=$(git diff --name-only --cached | head -5 | tr '\n' ', ' | sed 's/,$//')
fi

# Read the template, replace placeholders with actual content, write to temp file
sed -e "s/<commit subject>/$COMMIT_SUBJECT/g" \
    -e "s/<comma-separated changed filenames, shortened>/$CHANGED_FILES/g" \
    "$TEMPLATE_FILE" > "$BODY_FILE"
```

**If no template file exists**, generate a minimal body and write it to a temp file:

```bash
BODY_FILE=$(mktemp)

# Handle root commit (no parent) gracefully
if git rev-parse HEAD~1 >/dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only HEAD~1 | head -5 | tr '\n' ', ' | sed 's/,$//')
else
  CHANGED_FILES=$(git diff --name-only --cached | head -5 | tr '\n' ', ' | sed 's/,$//')
fi

cat > "$BODY_FILE" << BODYEOF
**Commit:** \`$(git log -1 --oneline)\`

**Changed files:** \`$CHANGED_FILES\`
BODYEOF
```

**If `ISSUE_ID` is set**, append a `Closes` line to the body file so the source issue auto-closes when the PR merges:

```bash
if [ -n "$ISSUE_ID" ]; then
  echo "" >> "$BODY_FILE"
  echo "Closes #$ISSUE_ID" >> "$BODY_FILE"
fi
```

### 8.3 Create the PR

**If `TEMPLATE_FILE` was found in Step 8.2:** Use the filled-in body from the temp file (Rule 5.4 compliance). Fill in every section from the template — do not leave any blank. If a section is not applicable, write `N/A`.

```bash
# Use the populated body file, not the raw template
# Include --repo for worktree compatibility
gh pr create \
  --title "<synthesized-title>" \
  --body-file "$BODY_FILE" \
  --base main \
  --assignee "$GH_OWNER" \
  --repo "$GH_REPO"
```

If `gh pr create` does not support `--body-file` in your version, use stdin:

```bash
gh pr create \
  --title "<synthesized-title>" \
  --body "@-" \
  --base main \
  --assignee "$GH_OWNER" \
  --repo "$GH_REPO" < "$BODY_FILE"
```

**If no template file exists:** Use the minimal body from the temp file:

```bash
gh pr create \
  --title "<synthesized-title>" \
  --body-file "$BODY_FILE" \
  --base main \
  --assignee "$GH_OWNER" \
  --repo "$GH_REPO"
```

**Label selection:** Infer from the commit type determined in Step 5.1:
- If the subject starts with or implies a bug fix → add `--label "bug"`
- Otherwise → add `--label "feature"`
- If multiple types are present, use `"bug"` only if any commit is a fix; otherwise `"feature"`

**After creating the PR, print the structured output:**

```
PR_NUMBER=<number>
PR_URL=<url>
```

Extract the number from the `gh pr create` output or from the PR URL. The URL format is `https://github.com/<owner>/<repo>/pull/<number>`.

## 9. Verification

### 9.1 Verify PR Body

After the PR is created (Step 8) or updated (Step 7), verify the PR body was set correctly by reading it back from the API. Use the `PR_NUMBER` from the structured output in Step 7 or 8:

```bash
ACTUAL_BODY=$(gh pr view "$PR_NUMBER" --json body --jq '.body' 2>/dev/null || true)
EXPECTED_BODY=$(cat "$BODY_FILE" 2>/dev/null || true)
if [ -n "$ACTUAL_BODY" ] && [ -n "$EXPECTED_BODY" ]; then
  if [ "$ACTUAL_BODY" = "$EXPECTED_BODY" ]; then
    echo "PR body verified successfully."
  else
    echo "WARNING: PR body mismatch detected."
    echo "Expected:"
    echo "$EXPECTED_BODY"
    echo ""
    echo "Actual:"
    echo "$ACTUAL_BODY"
    echo ""
    echo "Attempting to fix..."
    gh api "repos/$GH_REPO/pulls/$PR_NUMBER" -X PATCH -f body="$EXPECTED_BODY" 2>/dev/null || true
  fi
fi
```

### 9.2 Confirm PR URL

- Confirm the PR was created successfully (or note the existing PR URL from Step 7).
- Output the PR URL for the user so they can review it.

Example output:
```
PR created: https://github.com/<owner>/<repo>/pull/<number>
```

## Gotchas

- **Never commit directly to `main`.** Always create a feature branch first. The skill synthesizes a branch name automatically if none exists.
- **Empty change sets are silently rejected.** If `git status --porcelain` returns nothing after staging, the skill stops — no empty commits are created.
- **Existing PRs are detected and reused.** If a PR already exists for the branch, the skill skips PR creation and reports the existing PR number. Do not create duplicate PRs.
- **PR template sections must never be left blank.** If a section does not apply, write `N/A` rather than skipping it.

## Error Handling