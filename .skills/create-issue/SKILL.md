---
name: create-issue
description: Receives a user description, synthesizes it into a title and description, categorizes as 'fix' or 'feat', creates a GitHub issue, audits the codebase for actionable details, and updates the issue with findings.
license: BSD 3-Clause
compatibility: Requires gh CLI authenticated with the repo. Must be run from the project root.
metadata:
  agent: coding
---

# Create Issue

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

Receives a user description, synthesizes it into a polished title and description, categorizes the work as a **fix** or **feat**, creates a GitHub issue, audits the codebase for actionable details, and updates the issue with findings.

## Workflow

### 1. Parse Input

The user's description is provided in the command context (the text after `/create-issue`). **Use it directly.** Do not ask the user for it.

If no description was provided, ask the user for one.

### 2. Categorize

**CRITICAL LABEL RULE:** The only valid GitHub labels are `bug` and `feature`. **Never** use `enhancement`, `improvement`, `refactor`, `docs`, or any other label. This is non-negotiable.

Analyze the user's description and determine whether this is a **fix** or a **feat**:

- **fix** — A bug, regression, unexpected behavior, crash, or something that is broken and needs repair.
- **feat** — A new capability, enhancement, improvement, or something that doesn't exist yet.

**Default to `feat` (→ `feature` label) unless the description is clearly a bug.** If you are even slightly uncertain, it is a feature. There is no third option.

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to categorize instead of reasoning it out manually. Pass the user's description as state.

```
Question: "Is this a fix or a feat?"
Type: choice
Options: fix, feat
Criteria:
  fix  = bug, regression, unexpected behavior, crash, or something broken that needs repair
  feat = new capability, enhancement, improvement, or something that doesn't exist yet
Example answer: feat
```

Interpret the returned label directly. Fall back to the default-to-feat rule if no decision tool is available.

**Capture the category and label as variables:**

```bash
# Set CATEGORY and LABEL based on the analysis above
CATEGORY="<fix|feat>"
LABEL="<bug|feature>"
```

### 2.5. Scope Judgment — Check for bundling

**Before synthesizing the title, check whether the user's description bundles multiple independent capabilities into a single issue.** If it does, recommend splitting before implementation.

**Judgment criteria — recommend splitting if any of these apply:**

- **Multiple distinct tools/capabilities** — e.g., "add clipboard, browser automation, and desktop automation" (3 separate tools)
- **Multiple API integrations** — e.g., "add Google Docs, Sheets, Drive, Word, Excel, OneDrive" (6 separate APIs)
- **Multiple capability areas in one tool** — e.g., "add copywriting, SEO, social media, translation, and text extraction" (5+ capability areas)
- **Clear separation of concerns** — e.g., clipboard (simple, cross-platform) vs browser automation (heavy, platform-specific)

**Structured decision:** If the harness provides a structured-decision tool (e.g., `decision`), use it to judge whether to split. Pass the description as state.

```
Question: "Does this issue bundle multiple independent capabilities that should be split?"
Type: noul
Criteria:
  false = single narrow capability
  true  = 2+ distinct tools/APIs/capability areas
Example answer: true
```

**Important:** The `noul` type returns a *single float in [0,1]*, not a label — it is the probability of `true`. Interpret it as: `≥ 0.6` → true (split), `≤ 0.4` → false (don't split), between → unknown. Fall back to the judgment criteria above if no decision tool is available.

**Action:**

- **If the issue is narrow** (one tool, one API, one capability area): proceed to step 3.
- **If the issue is broad** (bundles 2+ distinct capabilities): proceed to step 3 but **append a "Split Recommendation"** section to the synthesized body (see step 4.6). In the final report, note: `Split recommended: <reason>`.

**Do NOT refuse to create the issue.** Create it as requested, but flag the bundling so the implementer can split it during the fix phase.

### 3. Synthesize Title

Create a concise, conventional-commit-style title:

- **Fix:** `fix: <short description>` — e.g., `fix: crash on empty input`
- **Feat:** `feat: <short description>` — e.g., `feat: add file upload endpoint`

Keep it under 70 characters. Be specific but terse. No trailing punctuation.

**Capture the title in a variable:**

```bash
SYNTHESIZED_TITLE="<fix|feat>: <short description>"
```

### 4. Synthesize Description

Read the appropriate template from disk, then populate every section with synthesized content derived from the user's description.

**This is purely a grammatical task.** Do not search the codebase, read source files, or look up implementation details. You are rephrasing and structuring what the user has already told you — not investigating the code. The audit (step 6) is where code investigation happens. If you don't know a detail, write `Unknown — user to confirm`.

**Read the template first** — the skill must load the actual file from `.github/ISSUE_TEMPLATE/` so it stays in sync with whatever is on disk:

- **fix** → first try `.github/ISSUE_TEMPLATE/bug_report.md`, fall back to `.github/ISSUE_TEMPLATE.md`
- **feat** → first try `.github/ISSUE_TEMPLATE/feature_request.md`, fall back to `.github/ISSUE_TEMPLATE.md`

**Verify template exists before reading**; fall back gracefully:

```bash
# Determine which template to use
if [ "$CATEGORY" = "fix" ]; then
  TEMPLATE_PATH=".github/ISSUE_TEMPLATE/bug_report.md"
else
  TEMPLATE_PATH=".github/ISSUE_TEMPLATE/feature_request.md"
fi

# Try the specific template first, then fall back to the general one
if [ ! -f "$TEMPLATE_PATH" ]; then
  TEMPLATE_PATH=".github/ISSUE_TEMPLATE.md"
fi

# If nothing exists, report error and stop
if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "ERROR: No issue template found. Expected one of:"
  echo "  .github/ISSUE_TEMPLATE/bug_report.md"
  echo "  .github/ISSUE_TEMPLATE/feature_request.md"
  echo "  .github/ISSUE_TEMPLATE.md"
  exit 1
fi
```

The template may contain YAML frontmatter — strip it before populating. Use `sed` to remove lines between the first `---` and second `---` portably (with `-e` for multi-command):

```bash
# Strip YAML frontmatter (lines between first and second ---)
# Two-pass approach for POSIX sed compatibility:
#   Pass 1: delete from line 1 through first --- (inclusive)
#   Pass 2: delete from the next --- through end of file
sed '1,/^---$/d' "$TEMPLATE_PATH" | sed '1,/^---$/d'
```

**Rules for synthesis:**
- Fill **every** section. Never leave a section blank.
- If you cannot infer a detail (e.g., OS, Node version), write `Unknown — user to confirm` rather than guessing.
- The **Summary** should be 1-2 sentences, clear and direct.
- The **Motivation** (for feats) should explain the "why" — the problem being solved.
- The **Proposed Solution** (for feats) should be actionable — what the implementation would look like.
- For fixes, the **Reproduction** steps should be concrete and sequential.
- For fixes, the **Expected** vs **Actual** behavior should be clearly contrasted.

**For feat issues, append these sections after the Proposed Solution (before Alternatives Considered):**

- **Dependencies** — Name the npm packages (or system dependencies) the implementation will use, with version ranges and a brief justification. If the user didn't specify, research the most common/active package for the capability. Format:
  ```markdown
  ## Dependencies

  - **<Package name>** (v<x.y.z>+ — <brief justification, e.g., "actively maintained, 2M+ weekly downloads">)
  - **System dependency** — <if applicable, e.g., "Python 3.10+ with pip">
  ```

- **Testing Strategy** — One paragraph describing how the feature will be tested. Include unit tests, integration tests, and edge cases. Format:
  ```markdown
  ## Testing Strategy

  - **Unit tests**: <what to test, e.g., "Verify Zod schema validation for all inputs">
  - **Integration test**: <how to test end-to-end, e.g., "Generate output and verify structure">
  - **Edge cases**: <list 2-3 edge cases, e.g., "Empty input, very long text, unsupported formats">
  ```

- **Security Considerations** — One paragraph referencing AGENTS.md 1.2 requirements. Include credential management, input validation, and any OWASP-relevant concerns. Format:
  ```markdown
  ## Security Considerations

  - **Credential storage**: <e.g., "All API keys stored in process.env only — never in config files">
  - **Input validation**: <e.g., "Validate all user input against Zod schemas before processing">
  - **OWASP**: <e.g., "Parameterized queries for all database operations, URL allowlist for outbound requests">
  ```

**For fix issues, append these sections after the Expected/Actual contrast:**

- **Root Cause Analysis** — One paragraph describing the likely root cause based on the user's description. If you cannot determine the root cause from the description alone, write `Unknown — audit required`.
- **Testing Strategy** — One paragraph describing regression tests to prevent recurrence.
- **Security Considerations** — If the fix touches sensitive areas (auth, input handling, file I/O), note OWASP-relevant concerns.

**Capture the populated template body** — store it in `$FULL_TEMPLATE_BODY` for use in Step 5:

```bash
# Read the template, strip frontmatter, and store in variable
# Two-pass approach for POSIX sed compatibility:
#   Pass 1: delete from line 1 through first --- (inclusive)
#   Pass 2: delete from the next --- through end of file
FULL_TEMPLATE_BODY=$(sed '1,/^---$/d' "$TEMPLATE_PATH" | sed '1,/^---$/d')
```

### 4.5. Populate Environment Section

**If the template contains an "Environment" section, populate it with live machine details before creating the issue.** Do this after step 4 (Synthesize Description) and before step 5 (Create the Issue).

1. **Check for an Environment section** — Scan the populated template body for a section titled `## Environment` (or similar, case-insensitive). If none exists, skip this step.

2. **Gather machine details:**
   - **OS:** Run `uname -s` and `uname -r` to get the OS name and kernel version. Format: `OS_NAME KERNEL_VERSION` (e.g., `Linux 7.0.2-7-pve`).
   - **Node.js:** Run `node --version` to get the Node version (e.g., `v25.8.1`).
   - **madz version:** Read `package.json` from the project root and extract the `version` field. Use `node -e "console.log(require('./package.json').version)"`.
   - **LLM provider:** If the user's description mentions a specific provider (e.g., OpenAI, Anthropic), use that. Otherwise write `Unknown — user to confirm`.

3. **Replace placeholder values** — In the template body, replace the Environment section's placeholder lines with the actual values. Typical placeholders look like:
   ```
   - **OS**: (e.g., macOS 14.5, Ubuntu 24.04, Windows 11)
   - **Node.js**: (e.g., 24.2.0)
   - **madz version**: (e.g., 1.7.3 — check `npm list @avoidwork/madz` or Docker tag)
   - **LLM provider**: (e.g., OpenAI gpt-4o, Anthropic claude-3.5-sonnet)
   ```
   Replace each line's placeholder with the actual value. Preserve the `**KEY**:` format.

4. **Handle `#` characters carefully** — GitHub interprets `#` as a link trigger in certain contexts. When writing values, **always omit `#` in inline content**:

    - ❌ `issue #290` in prose → ✅ `issue 290` in prose
    - ❌ `line #42` → ✅ `line 42`
    - ❌ `v25#8` → ✅ `v25.8`

    **Exception:** Issue references in the form `#<number>` (e.g., `resolves #42`, `see #17`) are **preserved** and SHOULD NOT be stripped — GitHub uses them to create clickable links to those issues. This rule applies only to stray `#` characters in content, not to valid GitHub issue references.

5. **Write the updated body** to the temp file before proceeding to step 5.

### 4.6. Append Split Recommendation (if scope judgment triggered)

**If step 2.5 flagged bundling, append a "Split Recommendation" section to the issue body.** This goes after the Environment section (step 4.5) and before the OpenSpec Note.

```markdown
## Split Recommendation

This issue bundles multiple distinct capabilities. Consider splitting into separate issues:

- **<Capability 1>** — <brief reason why it should be separate>
- **<Capability 2>** — <brief reason why it should be separate>
- **<Capability 3>** — <brief reason why it should be separate>

**MVP recommendation:** Start with <first capability> as it has the least dependencies and highest immediate value.
```

**Write the updated body** to the temp file before proceeding to step 5.

**Example transformation:**
```
Before:
## Environment
- **OS**: (e.g., macOS 14.5, Ubuntu 24.04, Windows 11)
- **Node.js**: (e.g., 24.2.0)
- **madz version**: (e.g., 1.7.3)
- **LLM provider**: (e.g., OpenAI gpt-4o)

After:
## Environment
- **OS**: Linux 7.0.2-7-pve
- **Node.js**: v25.8.1
- **madz version**: 1.7.5
- **LLM provider**: OpenAI gpt-4o
```

### 5. Create the Issue — **EXECUTE THIS BEFORE ANY CODE SEARCH**

**This is the hard stop.** You must create the GitHub issue *now*, with nothing more than the synthesized title and description. No codebase search. No audit. No looking at files. The issue must exist on GitHub before you touch a single source file.

**Determine the target repository dynamically from the git remote.** Never hardcode a repo name:

```bash
# Extract owner/repo from git remote URL — handles both HTTPS and SSH
GIT_REMOTE=$(git remote get-url origin 2>/dev/null)
if [ -z "$GIT_REMOTE" ]; then
  echo "ERROR: No git remote 'origin' found. Cannot determine repository."
  exit 1
fi

GH_REPO_FLAG=""
# SSH format: git@github.com:owner/repo.git
if echo "$GIT_REMOTE" | grep -q '^git@'; then
  GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)\.git$/\1/')
  if [ -z "$GH_REPO" ]; then
    GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*@[^:]*:\(.*\)$/\1/')
  fi
  GH_REPO_FLAG="--repo $GH_REPO"
# HTTPS format: https://github.com/owner/repo.git or https://TOKEN@github.com/owner/repo.git
elif echo "$GIT_REMOTE" | grep -q 'github\.com'; then
  GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)\.git$/\1/')
  if [ -z "$GH_REPO" ]; then
    GH_REPO=$(echo "$GIT_REMOTE" | sed 's/.*github\.com[/:]\(.*\)$/\1/')
  fi
  GH_REPO_FLAG="--repo $GH_REPO"
fi

if [ -z "$GH_REPO" ]; then
  echo "ERROR: Could not parse repository from remote '$GIT_REMOTE'. Cannot create issue."
  exit 1
fi

# Validate GH_REPO is non-empty and contains a slash (owner/repo format)
if ! echo "$GH_REPO" | grep -q '/'; then
  echo "ERROR: Parsed repository '$GH_REPO' does not look like 'owner/repo'. Check remote URL."
  exit 1
fi
```

**Execution order is non-negotiable:**
1. Synthesize title and description (steps 2–4)
2. Populate Environment section if present (step 4.5)
3. **Create the issue on GitHub** (this step)
4. *Then and only then* proceed to the audit (step 6)

**Cleanup:** Remove `BODY_FILE` once the issue is created, or when cleaning up after a failure. Do not rely on a shell `trap` — delete the temp file explicitly when the task completes.

```bash
BODY_FILE=$(mktemp)

cat > "$BODY_FILE" << BODYEOF
$(echo "$FULL_TEMPLATE_BODY" | sed "s|<SYNTHESIZED_TITLE>|$SYNTHESIZED_TITLE|g")
BODYEOF

ISSUE_URL=$(gh issue create \
  --title "$SYNTHESIZED_TITLE" \
  --body-file "$BODY_FILE" \
  --label "$LABEL" \
  $GH_REPO_FLAG)

ISSUE_NUMBER=$(echo "$ISSUE_URL" | sed 's/.*\/issues\/\([0-9]\{1,\}\).*/\1/')

# Verify the issue was created successfully and is open
ISSUE_STATE=$(gh issue view "$ISSUE_NUMBER" --json state --jq '.state' $GH_REPO_FLAG 2>/dev/null || true)
if [ "$ISSUE_STATE" != "OPEN" ]; then
  echo "ERROR: Issue #$ISSUE_NUMBER was created but state is '$ISSUE_STATE' (expected OPEN). Aborting."
  rm -f "$BODY_FILE"
  exit 1
fi
echo "Issue #$ISSUE_NUMBER verified as OPEN."

rm -f "$BODY_FILE"
```

**Important:** Replace all `<PLACEHOLDER>` tokens with actual variable values before executing. Never pass literal placeholder strings to `gh` commands.

**STOP here.** The issue is created. Report the number and URL. Then proceed to step 6.

### 6. Light Audit — Gather actionable context

*Now* that the issue exists, do a **targeted, lightweight** audit. **You must use the `ISSUE_NUMBER` returned in Step 5.** Anchor every finding to this specific issue. The goal is to surface useful context — not to solve the problem or write a treatise.

#### For **fix** issues — quick root-ause hunt:

1. **Search for relevant code** — Use `searchFiles` to find files, functions, or patterns related to the bug.
2. **Read the most relevant file** — Open one or two key files. Look for the code that handles the reported scenario.
3. **Note what you find** — File paths, line numbers, function names, the likely culprit. Keep it brief. Explicitly reference `#<ISSUE_NUMBER>` when documenting findings.

#### For **feat** issues — quick landscape scan:

1. **Search for existing related functionality** — What's already there?
2. **Identify integration points** — Where would this plug in?
3. **Note relevant files** — Which files would need changes? Explicitly reference `#<ISSUE_NUMBER>` when documenting findings.

**Time budget:** Keep this to a few focused searches and reads. If the audit yields nothing obvious, move on — don't spin your wheels.

#### Audit output format:

```markdown
## Audit Findings (for Issue #<ISSUE_NUMBER>)

- **File**: `path/to/file.ts` — <brief, actionable observation>
- `path/to/related.ts` — <why this is relevant>
- <any concrete guidance for the implementer>
```

### 6.5 Update Issue with Audit Findings

**After the audit (step 6), append the findings to the issue body.** Do not skip this step — the audit notes must be visible on the issue.

1. **Build the audit section** using the format from step 6.

2. **Append to the existing issue body** using `gh issue edit`. Read the current body, append the audit section, and write the combined body back:

```bash
# Read current body
CURRENT_BODY=$(gh issue view <ISSUE_NUMBER> --json body --jq '.body')

# Build the audit section
AUDIT_SECTION="
## Audit Findings (for Issue #${ISSUE_NUMBER})

- **<file-path>** — <brief, actionable observation>
- <more findings...>
"

# Append and update — write CURRENT_BODY + AUDIT_SECTION to temp file
AUDIT_FILE=$(mktemp)
cat > "$AUDIT_FILE" << AUDITEOF
${CURRENT_BODY}
${AUDIT_SECTION}
AUDITEOF

gh issue edit "$ISSUE_NUMBER" --body-file "$AUDIT_FILE" $GH_REPO_FLAG
rm -f "$AUDIT_FILE"
```

3. **Verify the audit notes are present.** Read the issue back and confirm the audit section exists:

```bash
VERIFY=$(gh issue view "$ISSUE_NUMBER" --json body --jq '.body' $GH_REPO_FLAG)
if echo "$VERIFY" | grep -q "Audit Findings"; then
  echo "Audit notes verified on issue."
else
  echo "WARNING: Audit notes not found on issue. Retrying..."
  # Retry once with the same append logic
  printf '%s\n' "${CURRENT_BODY}${AUDIT_SECTION}" | gh issue edit "$ISSUE_NUMBER" --body-file - $GH_REPO_FLAG
fi
```

4. **If verification fails after retry**, report the failure in the final summary but do not block — the issue still exists.

### 6.5.1 Handle Large Audit Findings

GitHub issue bodies have a 65,536 character limit. If your audit findings are large:
- Keep findings concise — one line per file, no verbose explanations
- If findings exceed 10,000 characters, summarize: list files with issues and note "Full details in attached log" (then attach if possible)
- Never truncate mid-sentence — always end with a complete thought

### 6.6. Fix Steps — Actionable implementation guidance

**After the audit (step 6), append a "Fix Steps" section to the issue body.** This gives the implementer a clear, sequential path from zero to working code. Do not skip this step — it is what makes the issue actionable.

**For fix issues, the Fix Steps should include:**

```markdown
## Fix Steps

1. **Locate the bug** — Open `path/to/file.ts` and find the code at line <N> that causes the issue.
2. **Add validation** — Insert a check at line <N> that validates <input/state> before <operation>.
3. **Handle the error** — Return a user-friendly error message instead of crashing.
4. **Add a test** — Create `tests/unit/path/to/file.test.js` with a test case for the edge case.
5. **Verify** — Run `npm run test` and `npm run coverage` to confirm no regressions.
```

**For feat issues, the Fix Steps should include:**

```markdown
## Fix Steps

1. **Create the tool file** — Add `src/tools/<name>/index.js` with a Zod schema and impl function.
2. **Register the tool** — Add the tool to `src/tools/index.js` with the appropriate permissions.
3. **Write unit tests** — Add `tests/unit/tools/<name>.test.js` covering schema validation and core logic.
4. **Write integration test** — Add `tests/integration/tools/<name>.test.js` covering end-to-end behavior.
5. **Update documentation** — Add JSDoc comments to all public functions with `@param` and `@returns`.
6. **Verify** — Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
```

**General rules for Fix Steps:**
- Be specific — reference actual file paths, line numbers, and function names from the audit.
- Be sequential — each step should build on the previous one.
- Include verification — always end with a step that confirms the fix/feature works (tests, lint, coverage).
- If the audit didn't yield specific file paths, use placeholders: `src/tools/<name>/index.js`, `tests/unit/tools/<name>.test.js`.
- Keep it to 5-7 steps max. If more are needed, group related steps.

### 7. Report

Print a final summary:

```
Created issue #<ID>: <TITLE>
URL: <URL>
Category: <fix|feat>
Audit: <brief note on what was found — e.g., "root cause identified in callHandler.ts:142" or "mapped 3 integration points for proposed feature">
```

## Error Handling

- **Not authenticated:** Suggest running `gh auth login`.
- **Network error:** Retry once, then report the failure.
- **Template not found:** Report the error and stop — do not proceed without the template.
- **GitHub API error:** Report the specific error message and stop.
- **Audit yields nothing:** If the codebase search returns no relevant results, note "No relevant code paths found — issue may be environment-specific or in external dependencies." and still report the issue creation.

## Gotchas

- **Issue creation is the hard stop.** The issue must exist on GitHub before any codebase audit. Never search the codebase before creating the issue.
- **`#` characters in content are link triggers.** GitHub interprets `#` as a link trigger in certain contexts. Omit `#` in inline content (e.g., `line 42` not `line #42`), but preserve valid issue references like `resolves #42`.
- **Label discipline is strict.** Only `bug` and `feature` labels are valid. Never use `enhancement`, `improvement`, `refactor`, `docs`, or any other label.
- **Environment section must be populated.** If the template has an Environment section, always fill it with live machine details — never leave placeholders.

## Example

```
User: create-issue the TUI hangs when the user types a very long command and presses enter

Agent: Categorizing... This is a fix — the TUI should handle long input gracefully.

Synthesizing title: fix: TUI hangs on long command input

Filling bug_report template...
  Summary: The TUI freezes when a user enters a command exceeding a certain length and presses Enter.
  Reproduction: 1. Start madz TUI 2. Type a very long command (e.g., 500+ characters) 3. Press Enter
  Expected: The command is processed or truncated gracefully.
  Actual: The TUI becomes unresponsive and requires a force quit.
  Root Cause: Unknown — audit required
  Testing: Add regression test for long input in src/tui/inputPanel.test.js
  Security: Input validation prevents buffer overflow and DoS

Creating issue...
Created issue #256: fix: TUI hangs on long command input
URL: https://github.com/avoidwork/madz/issues/256

Auditing codebase...
  Found input handler in src/tui/inputPanel.ts:87 — no length validation before dispatch.
  Related: src/tui/provider.ts handles command dispatch but assumes valid input.

Updating issue with audit findings and fix steps...

Created issue #256: fix: TUI hangs on long command input
URL: https://github.com/avoidwork/madz/issues/256
Category: fix
Audit: Root cause in src/tui/inputPanel.ts:87 — no length validation before dispatch
Fix: 5 steps provided — locate bug, add validation, handle error, add test, verify
```

## Example — Broad Scope (Split Recommended)

```
User: create-issue add Google Docs, Sheets, Drive, Word, Excel, and OneDrive integration

Agent: Categorizing... This is a feat — new capability.
Scope judgment: Bundles 6 distinct API integrations. Recommend splitting.

Synthesizing title: feat: add Google Workspace / Microsoft 365 API integration

Filling feature_request template...
  Summary: Add tools for interacting with Google Workspace (Docs, Sheets, Drive) and Microsoft 365 (Word, Excel, OneDrive) via their respective APIs.
  Motivation: Real office workflows live in cloud productivity suites — users need to create, edit, and manage documents in these platforms directly.
  Proposed Solution: Create API integration tools for Google Docs, Sheets, Drive, Microsoft Word, Excel, and OneDrive.
  Dependencies: googleapis (v144.x), @microsoft/microsoft-graph-client (v3.x), google-auth-library (v9.x), @azure/identity (v4.x), better-sqlite3 (v11.x)
  Testing: Unit tests with mocked OAuth, integration tests with sandbox environments, edge cases for large docs and rate limits
  Security: Encrypted token storage, least-privilege scopes, rate limiting, PII handling

Creating issue...
Created issue #783: feat: add Google Workspace / Microsoft 365 API integration
URL: https://github.com/avoidwork/madz/issues/783

Auditing codebase...
  No existing cloud API tools found — this is a greenfield feature.
  Integration point: src/tools/index.js for tool registration.
  OAuth infrastructure: none exists yet — needs to be built first.

Updating issue with audit findings, dependencies, testing, security, and fix steps...

Created issue #783: feat: add Google Workspace / Microsoft 365 API integration
URL: https://github.com/avoidwork/madz/issues/783
Category: feat
Audit: Greenfield — no existing cloud API tools, OAuth infrastructure needed first
Split recommended: 6 APIs bundled — start with Google Docs + Sheets as MVP
Fix: 6 steps provided — create tool files, register, test, document, verify
```

---
