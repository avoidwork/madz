---
name: git-tag
description: Reads version from package.json (Node.js), pyproject.toml (Python), Cargo.toml (Rust), build.gradle (Java/Android), pom.xml (Maven), build.gradle.kts (Gradle Kotlin), pubspec.yaml (Dart), Gemfile (Ruby), or similar package manager files. Synthesizes a change description from git history delta, creates an annotated git tag (no "v" prefix), and pushes it to origin.
license: BSD 3-Clause
compatibility: Requires git CLI configured with remote access and a supported package manager file with a "version" field in the working directory (package.json, pyproject.toml, Cargo.toml, build.gradle, pom.xml, build.gradle.kts, pubspec.yaml, Gemfile, etc.).
metadata:
  agent: coding
---

# Git Tag

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

You must execute ALL steps in order. Do not stop until the tag is pushed and verified on the remote. If any step fails, report the error and stop — do not continue with incomplete work.

## Step 1: Read the Version

Detect the package manager and extract the version string. Try each file in order until one is found:

### 1a. Node.js (package.json)

If `package.json` exists, use `node` to reliably extract the top-level `version` field (avoids matching nested "version" keys):

```bash
if [ -f package.json ]; then
  TAG_VERSION=$(node -e "console.log(require('./package.json').version)")
  echo "TAG_VERSION=$TAG_VERSION"
  VERSION_SOURCE="package.json"
fi
```

If `node` is unavailable, fall back to grep:
```bash
TAG_VERSION=$(grep -m1 '"version"[[:space:]]*:' package.json | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
```

### 1b. Python (pyproject.toml)

If no `package.json` exists and `pyproject.toml` exists, extract the version from the `[project]` table:

```bash
if [ -z "$TAG_VERSION" ] && [ -f pyproject.toml ]; then
  # Try inline version field under [project]
  TAG_VERSION=$(grep -m1 '^version[[:space:]]*=' pyproject.toml | sed 's/^version[[:space:]]*=[[:space:]]*"\?\([^"]*\)"\?.*/\1/' | tr -d "'")
  if [ -n "$TAG_VERSION" ]; then
    echo "TAG_VERSION=$TAG_VERSION"
    VERSION_SOURCE="pyproject.toml"
  fi
fi
```

### 1c. Rust (Cargo.toml)

If no version found yet and `Cargo.toml` exists:

```bash
if [ -z "$TAG_VERSION" ] && [ -f Cargo.toml ]; then
  TAG_VERSION=$(grep -m1 '^version[[:space:]]*=' Cargo.toml | sed 's/^version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/')
  if [ -n "$TAG_VERSION" ]; then
    echo "TAG_VERSION=$TAG_VERSION"
    VERSION_SOURCE="Cargo.toml"
  fi
fi
```

### 1d. Java/Android/Gradle (build.gradle or build.gradle.kts)

If no version found yet and a Gradle build file exists:

```bash
if [ -z "$TAG_VERSION" ]; then
  if [ -f build.gradle ]; then
    # groovy: version '1.2.3' or version = '1.2.3'
    TAG_VERSION=$(grep -m1 -E "^\s*(version\s*[=:]?\s*['\"]|version\s+['\"])" build.gradle | sed "s/.*['\"]\\([0-9][0-9a-zA-Z._-]*\\)['\"].*/\\1/")
    VERSION_SOURCE="build.gradle"
  elif [ -f build.gradle.kts ]; then
    # kotlin: version = "1.2.3"
    TAG_VERSION=$(grep -m1 'version' build.gradle.kts | sed 's/.*version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/' | head -1)
    VERSION_SOURCE="build.gradle.kts"
  fi
  if [ -n "$TAG_VERSION" ]; then
    echo "TAG_VERSION=$TAG_VERSION"
  fi
fi
```

### 1e. Java/Maven (pom.xml)

If no version found yet and `pom.xml` exists:

```bash
if [ -z "$TAG_VERSION" ] && [ -f pom.xml ]; then
  # Extract project version — skip parent <version> by looking for
  # <version> directly under <project> (not under <parent>)
  TAG_VERSION=$(grep -A2 '<project>' pom.xml | grep -m1 '<version>' | sed 's|.*<version>\([^<]*\)</version>.*|\1|')
  if [ -z "$TAG_VERSION" ]; then
    # Fallback: first <version> that is NOT inside <parent>...</parent>
    TAG_VERSION=$(sed -n '/<parent>/,/<\/parent>/!p' pom.xml | grep -m1 '<version>' | sed 's|.*<version>\([^<]*\)</version>.*|\1|')
  fi
  if [ -n "$TAG_VERSION" ]; then
    echo "TAG_VERSION=$TAG_VERSION"
    VERSION_SOURCE="pom.xml"
  fi
fi
```

### 1f. Dart (pubspec.yaml)

If no version found yet and `pubspec.yaml` exists:

```bash
if [ -z "$TAG_VERSION" ] && [ -f pubspec.yaml ]; then
  TAG_VERSION=$(grep -m1 '^version:' pubspec.yaml | sed 's/^version:[[:space:]]*//' | sed 's/[[:space:]]*$//' | cut -d'+' -f1)
  if [ -n "$TAG_VERSION" ]; then
    echo "TAG_VERSION=$TAG_VERSION"
    VERSION_SOURCE="pubspec.yaml"
  fi
fi
```

### 1g. Ruby (.gemspec)

If no version found yet, check Gemfile or gemspec:

```bash
if [ -z "$TAG_VERSION" ]; then
  # Use a loop to handle glob safely (avoids issues with zero or multiple matches)
  for gemspec in *.gemspec; do
    if [ -f "$gemspec" ]; then
      TAG_VERSION=$(grep -m1 '\.version[[:space:]]*=' "$gemspec" | sed 's/.*\.version[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/' | head -1)
      if [ -n "$TAG_VERSION" ]; then
        echo "TAG_VERSION=$TAG_VERSION"
        VERSION_SOURCE="$gemspec"
      fi
    fi
    break
  done
fi
```

### 1h. Swift (Package.swift)

If no version found yet and `Package.swift` exists:

```bash
if [ -z "$TAG_VERSION" ] && [ -f Package.swift ]; then
  TAG_VERSION=$(grep -m1 'package\.version' Package.swift | sed 's/.*\.version(\s*"\([^"]*\)".*/\1/' | head -1)
  if [ -n "$TAG_VERSION" ]; then
    echo "TAG_VERSION=$TAG_VERSION"
    VERSION_SOURCE="Package.swift"
  fi
fi
```

### Fallback

If no version was found from any file, report an error and stop. Do not proceed with no version.

## Step 2: Check Pre-conditions

Before proceeding, verify:

```bash
# Ensure we're on a clean working tree
git status --porcelain
```

If there are uncommitted changes, report them to the user and stop. Do not tag a dirty tree.

**Check for detached HEAD:** If `git branch --show-current` returns empty, you're in detached HEAD state. Create a temporary branch first, and clean it up after the tag is pushed:
```bash
WAS_DETACHED=false
if [ -z "$(git branch --show-current)" ]; then
  echo "WARNING: Detached HEAD state. Creating temporary branch for tagging."
  git checkout -b "tag-temp-$(date -u +%Y%m%d%H%M%S)"
  WAS_DETACHED=true
fi
```

## Step 3: Find the Previous Tag

Find the closest prior tag to use as the delta baseline:

```bash
# Try to find previous tag in same minor version series
# Note: sort -V requires GNU sort; fall back to sort -t. -k1,1n -k2,2n -k3,3n if unavailable
PREV_TAG=$(git tag -l "${TAG_VERSION%.*}.*" 2>/dev/null | sort -V 2>/dev/null | grep -v "^${TAG_VERSION}$" | tail -1)
if [ -z "$PREV_TAG" ]; then
  PREV_TAG=$(git tag -l "${TAG_VERSION%.*}.*" 2>/dev/null | sort -t. -k1,1n -k2,2n -k3,3n 2>/dev/null | grep -v "^${TAG_VERSION}$" | tail -1)
fi
if [ -z "$PREV_TAG" ]; then
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")
fi
echo "PREV_TAG=$PREV_TAG"
```

If no previous tag exists, set `PREV_TAG=""` (empty).

## Step 4: Check for Existing Tag

Ensure the tag does not already exist locally or on the remote:

```bash
LOCAL_EXISTS=$(git tag -l "${TAG_VERSION}")
REMOTE_EXISTS=$(git ls-remote --tags origin "${TAG_VERSION}" 2>/dev/null)
```

If either `LOCAL_EXISTS` or `REMOTE_EXISTS` is non-empty, the tag already exists. Report this to the user and stop. Do not overwrite.

## Step 5: Gather Commits for Description

Collect the commit messages between the previous tag and HEAD. **Filter out merge commits** (messages starting with "Merge ") as they add noise. Capture into `COMMITS` for use by Step 6:

```bash
if [ -n "$PREV_TAG" ]; then
  COMMITS=$(git log --pretty=format:"%s" "${PREV_TAG}..HEAD" | grep -v "^Merge ")
else
  COMMITS=$(git log --pretty=format:"%s" --max-count=20 | grep -v "^Merge ")
fi
echo "COMMITS=$COMMITS" | cut -c1-2000
```

## Step 6: Synthesize the Description

Read the commit messages from Step 5 and write a concise, natural-language summary:

- **Group by topic** — Use conventional commit prefixes to group: `feat:` → features, `fix:` → fixes, `chore:` → chores, `docs:` → documentation, `refactor:` → refactors. If no conventional commit prefixes are present, group by keyword matching (e.g., "Dockerfile" → Docker, "config.yaml" → config).
- **2-4 sentences.** Present tense. Specific but not verbose.
- **No commit hashes or PR numbers.** Natural language only.
- **First line** is the release identifier (e.g., "Version 1.3.5 release.").
- **Remaining lines** describe what changed.

Example output format:
```
Version 1.3.5 release.

Includes a Dockerfile fix for the HOME environment variable, expanded scheduler documentation with atomicity directives, and a TUI audit fix proposal. Documentation updates cover config.yaml tracking, TUI command expansion, and scheduler documentation improvements.
```

Then synthesize and set `DESCRIPTION`:

```bash
if [ -z "$DESCRIPTION" ]; then
  DESCRIPTION="Version ${TAG_VERSION} release."
fi
```

If no commits can be analyzed, set DESCRIPTION to:

```bash
DESCRIPTION="Version ${TAG_VERSION} release."
```

## Step 7: Create the Tag

Create an annotated tag. **No "v" prefix.** Use the exact `TAG_VERSION` from Step 1:

```bash
git tag -a "$TAG_VERSION" -m "$DESCRIPTION"
```

Verify the tag exists:

```bash
git tag -l "$TAG_VERSION"
```

If the output is empty, the tag creation failed. Report the error and stop.

## Step 8: Push the Tag

**Check that remote exists before pushing:**
```bash
git remote get-url origin
```
If this fails, the remote is not configured. Report the error and stop.

Push to the remote:

```bash
git push origin "$TAG_VERSION"
```

**Check exit code:** If the push returns a non-zero exit code, report the error and stop. Common failures:
- **Remote not configured:** Suggest adding a remote (`git remote add origin <url>`)
- **Permission denied:** Check SSH keys or token permissions
- **Network error:** Retry once, then report

**Clean up temporary branch if we were in detached HEAD:**
```bash
if [ "$WAS_DETACHED" = true ]; then
  TEMP_BRANCH=$(git branch --show-current)
  git checkout --detach 2>/dev/null
  git branch -D "$TEMP_BRANCH" 2>/dev/null || true
fi
```

## Step 9: Verify the Push

Confirm the tag is on the remote:

```bash
git ls-remote --tags origin | grep "$TAG_VERSION"
```

If this returns nothing, the push failed. Report the error and stop.

## Step 10: Report

Print a final summary using actual variable values:

```
Tagged: $TAG_VERSION
From: ${PREV_TAG:-initial}
Commits: $(git log --oneline "${PREV_TAG:-HEAD}..HEAD" | wc -l)
Pushed: origin/$TAG_VERSION

$DESCRIPTION
```

## Gotchas

- **No "v" prefix.** The tag must use the exact version string from the package manager file (e.g., `1.3.5`, not `v1.3.5`).
- **Tags are immutable.** Once pushed, a tag cannot be overwritten. The skill checks for existing tags locally and on the remote before creating.
- **Clean working tree required.** The skill stops if there are uncommitted changes. A dirty tree means the tag would not represent a clean release.
- **Detached HEAD is handled automatically.** If in detached HEAD state, the skill creates a temporary branch for tagging.

---
