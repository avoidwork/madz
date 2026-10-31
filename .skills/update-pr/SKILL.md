---
name: update-pr
description: Update an existing PR's title and description by scanning project rules for conventions and the PR template, synthesizing both from the delta between the branch and target, then applying changes via 'gh api' (gh pr edit fails in this repo).
license: BSD 3-Clause
compatibility: Requires gh CLI authenticated with a repo that has .github/PULL_REQUEST_TEMPLATE.md.
metadata:
  version: 1.0
  agent: coding
---

# Update PR

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Update an existing pull request's title and description following project conventions.

## When to Use

- The user asks to update a PR's title or description
- A PR was opened with a generic or incomplete title/description
- The user wants to align PR metadata with project rules

## Steps

1. **Identify the PR**

    The PR number is provided in the chain context (the text after `/update-pr`). If no PR number is provided, report an error and stop — this skill requires a specific PR to update.

    **Determine the target repository dynamically from the git remote.** Never hardcode a repo name:

    ```bash
    # Extract owner/repo from git remote URL — handles both HTTPS and SSH
    GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
    if echo "$GIT_REMOTE" | grep -q '^git@'; then
      GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)\.git$/\1/')
      if [ -z "$GH_REPO" ]; then
        GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)$/\1/')
      fi
    elif echo "$GIT_REMOTE" | grep -q 'github\.com'; then
      GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)\.git$/\1/')
      if [ -z "$GH_REPO" ]; then
        GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)$/\1/')
      fi
    else
      echo "ERROR: Could not parse repository from remote '$GIT_REMOTE'."
      exit 1
    fi

    # Validate GH_REPO is non-empty and contains a slash (owner/repo format)
    if [ -z "$GH_REPO" ] || ! echo "$GH_REPO" | grep -q '/'; then
      echo "ERROR: Parsed repository '$GH_REPO' does not look like 'owner/repo'. Check remote URL."
      exit 1
    fi
    ```

    Confirm the PR exists:
    ```bash
    gh pr view <PR_NUMBER> --json title,state,url --repo "$GH_REPO"
    ```

2. **Scan Project Rules**

   Scan the project root and any specified paths for a `.agent` rules file and read its contents:

   ```
   # Scan the project root for AGENTS.md or similar rules file
   ```

   Extract:
   - **Commit style** (Conventional Commits format from section 5.1)
   - **PR template** requirements from section 5.4 (and `.github/PULL_REQUEST_TEMPLATE.md` if it exists)
   - Any project-specific rules that affect the PR description

3. **Read the PR template**

   ```bash
   if [ -f ".github/PULL_REQUEST_TEMPLATE.md" ]; then
     cat .github/PULL_REQUEST_TEMPLATE.md
   else
     echo "WARNING: No .github/PULL_REQUEST_TEMPLATE.md found. Using default structure."
   fi
   ```

   If the file doesn't exist, construct a reasonable description with: Description, Type of Change, Testing, Coverage, Checklist.

4. **Gather the full delta**

   You must collect the complete picture — every commit and every file change between the branch and its target. Do not rely on the most recent commit alone.

   ```bash
   # Get base and head refs from the PR
   BASE_REF=$(gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName' --repo "$GH_REPO")
   HEAD_REF=$(gh pr view <PR_NUMBER> --json headRefName --jq '.headRefName' --repo "$GH_REPO")
   ```

   From this data, identify:
   - **All files changed** and what kind of change each represents
   - **All commits** and their messages (these are your primary signal for the title)
   - **The nature of changes**: code, docs, tests, config, etc.

   ```bash
   # Get all commits on the branch (oldest first)
   git log --reverse "${BASE_REF}..${HEAD_REF}" --oneline --no-decorate

   # Get the full diff stats (files changed, lines added/removed)
   git diff "${BASE_REF}..${HEAD_REF}" --stat

   # Get the full diff (for detailed change analysis) — NOTE: On large branches, this may produce very large output.
   # If output exceeds ~50,000 characters, use --stat only and note "Large delta — full diff truncated."
   git diff "${BASE_REF}..${HEAD_REF}"
   ```

5. **Draft the title**

   Synthesize the title from the **complete delta** — all commits and all file changes. Follow Conventional Commits format: `<type>: <short description>`

   **Type selection priority** (use the highest-priority type present in the delta):
   1. `fix:` — if any commit fixes a bug
   2. `feat:` — if any commit adds a feature
   3. `docs:` — if only documentation/spec changes
   4. `test:` — if only test changes
   5. `refactor:` — if only refactoring with no behavior change
   6. `chore:` — if only maintenance tasks

   **Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to pick the type instead of reasoning it out manually. Feed the commit delta as state.

   ```
   Question: "Which conventional-commit type should the PR title use?"
   Type: choice
   Options: fix, feat, docs, test, refactor, chore
   Criteria:
     fix      = any commit fixes a bug
     feat     = any commit adds a feature
     docs     = only documentation/spec changes
     test     = only test changes
     refactor = only refactoring with no behavior change
     chore    = only maintenance tasks
   Example answer: feat
   ```

   Interpret the returned label directly. Fall back to the priority rule above if no decision tool is available.

   **Description selection:**
   - If all commits share a common theme, use that as the description.
   - If commits span multiple themes, use the **primary** theme (the one with the most commits or the most impactful change).
   - Keep it under 72 characters. Be specific — avoid vague phrases like "update" or "changes."

   Examples:
   - `fix: resolve agent stalling on empty conversation history`
   - `feat: add cron-based auto-reflection scheduling`
   - `docs: add compliance framework and borderline escalation rules to safety guidelines`

   **Assign the synthesized title:**
   ```bash
   DRAFTED_TITLE="<type>: <short description>"
   echo "DRAFTED_TITLE=$DRAFTED_TITLE"
   ```

6. **Draft the description**

   Synthesize the description from the **complete delta** — all commits and all file changes. Fill out every section of the PR template. Never leave a section blank — use `N/A` if not applicable.

   **Description body:**
   - Write a concise 1-3 sentence summary of what changed across the **entire branch**, not just the last commit.
   - Reference all files changed and the nature of each change.
   - If the branch has multiple commits, mention the scope: e.g., "This change adds X and also updates Y to align with Z."

   **Template sections:**
   - **Type of Change:** Check the box that matches the highest-priority type (same priority as title: fix > feat > docs > test > refactor > chore). If multiple types apply, check the highest-priority one.
   - **Testing:** Describe tests written/run and their coverage. Use "N/A" for doc-only or config-only changes.
   - **Coverage:** Confirm 100% line coverage maintained (check the box if no code changes or if coverage is maintained).
   - **Checklist:** Check all boxes if no violations. Uncheck any that don't apply.

7. **Apply via `gh api`**

    **Never use `gh pr edit` — it fails in this repo.** Use the GitHub API instead. Continue using the `$GH_REPO` variable extracted in Step 1:

    ```bash
    # Build JSON payload with jq to handle multi-line body safely
    # If jq is unavailable, fall back to temp file approach
    if command -v jq >/dev/null 2>&1; then
      PAYLOAD=$(jq -n --arg title "$DRAFTED_TITLE" --arg body "$DRAFTED_BODY" '{title: $title, body: $body}')
      if ! echo "$PAYLOAD" | gh api "repos/$GH_REPO/pulls/$PR_NUMBER" --input - >/dev/null 2>&1; then
        echo "ERROR: Failed to update PR #$PR_NUMBER via API."
        exit 1
      fi
    else
      # Fallback: write body to temp file
      PR_BODY_FILE=$(mktemp)
      printf '%s\n' "$DRAFTED_BODY" > "$PR_BODY_FILE"
      if ! gh api "repos/$GH_REPO/pulls/$PR_NUMBER" \
        -f title="$DRAFTED_TITLE" \
        -f body="$(cat "$PR_BODY_FILE")" >/dev/null 2>&1; then
        echo "ERROR: Failed to update PR #$PR_NUMBER via API."
        rm -f "$PR_BODY_FILE"
        exit 1
      fi
      rm -f "$PR_BODY_FILE"
    fi

    # Verify the update succeeded by reading back the title
    VERIFY_TITLE=$(gh pr view "$PR_NUMBER" --json title --jq '.title' --repo "$GH_REPO" 2>/dev/null || true)
    if [ "$VERIFY_TITLE" != "$DRAFTED_TITLE" ]; then
      echo "ERROR: PR title update verification failed. Expected '$DRAFTED_TITLE', got '$VERIFY_TITLE'."
      exit 1
    fi
    echo "PR title verified: $VERIFY_TITLE"
    ```

    **Handle API errors:** If the API call returns a non-200 status, report the error and stop. Common errors:
    - **403 Forbidden:** Check authentication and permissions
    - **404 Not Found:** Verify PR number and repo
    - **422 Unprocessable Entity:** Check title/body format (title under 72 chars, body not empty)

   **Coverage verification:** The skill instructs to "Confirm 100% line coverage maintained" but there's no way to verify this without running tests. If code changes were made, run `npm run coverage` and check the output. If no code changes were made (docs-only, config-only), note "No code changes — coverage N/A."

8. **Confirm**

   Show the user the updated PR URL and a summary of what changed.

## Example

```bash
gh api "repos/$GH_REPO/pulls/<PR_NUMBER>" \
  -f title="feat: add OpenAPI spec generation for REST endpoints" \
  -f body="## Description\n\nAdded automatic OpenAPI spec generation for all REST endpoints.\n\n## Type of Change\n\n- [x] New feature\n\n## Testing\n\n- [x] Unit tests included\n\n## Coverage\n\n- [x] 100% line coverage maintained\n\n## Checklist\n\n- [x] Conventional Commit style applied\n"
```

## Guardrails

- Always scan project rules by reading `AGENTS.md` (or `README.md`) from the project root before drafting — conventions may vary per project
- Synthesize title and description from the delta between branch and target — take all changes into account
- Never leave PR template sections blank; use `N/A`
- Use `gh api`, never `gh pr edit`
- Keep titles under 72 characters (Conventional Commits standard)
- If the PR doesn't exist or the user can't identify it, ask for clarification

## Gotchas

- **Never use `gh pr edit`.** It fails in this repo. Always use `gh api` to update the PR.
- **Coverage is a claim, not a verification.** The skill instructs to "confirm 100% line coverage maintained" but does not actually run tests. If code changes were made, run `npm run coverage` and check the output before making the claim.
- **Title priority is strict.** When multiple commit types exist, use the highest-priority type: fix > feat > docs > test > refactor > chore.
