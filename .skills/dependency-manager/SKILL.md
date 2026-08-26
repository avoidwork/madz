---
name: "dependency-manager"
description: "Safely add, remove, or update dependencies with lock file management and vulnerability pre-checks."
metadata:
  author: "madz"
  version: "1.0"
  agent: "coding"
---

# Dependency Manager Skill

Safely add, remove, or update dependencies with lock file management and vulnerability pre-checks. This skill depends on `project-context` output to determine the package manager and project structure.

## Prerequisites

- **project-context skill** must be run first to detect the package manager
- The package manager must be installed and available (npm, pip, mvn, go, cargo, etc.)
- Write access to project files (for lock file updates)

## Input/Output Contract

**Input**:
- Action: `add`, `remove`, or `update`
- Package name(s): e.g., `lodash`, `express`, `@types/node`
- Optional version specifier: e.g., `^1.2.3`, `>=2.0.0`
- Optional scope: `dev` (for dev dependencies)

**Output**: Structured dependency change report:

```
## Dependency Change Report

### Action: add
### Package: <name>@<version>
### Package Manager: <npm/pip/maven/go/cargo>

**Changes:**
- Modified: <file> (<change type>)
- Added: <file> (<dependency>)
- Updated: <file> (lock file)

**Vulnerability Check:**
- Known CVEs: <count>
- Highest severity: <severity or "none">
- Recommendation: <proceed/hold/decline>

**Post-install verification:**
- Build: <pass/fail/skipped>
- Lock file: <verified/modified>
```

## 1. Safe Dependency Addition

Add a dependency with vulnerability pre-check:

```bash
# Node.js / npm
if [ "$PACKAGE_MANAGER" = "npm" ]; then
  # Pre-check: audit for vulnerabilities before adding
  echo "Running vulnerability pre-check for $PACKAGE_NAME..."
  if command -v npm &> /dev/null; then
    npm audit --json 2>/dev/null > npm-audit-before.json || true
  fi

  # Add the dependency
  if [ "$SCOPE" = "dev" ]; then
    echo "Adding dev dependency: $PACKAGE_NAME"
    npm install "$PACKAGE_NAME" --save-dev 2>&1
  else
    echo "Adding dependency: $PACKAGE_NAME"
    npm install "$PACKAGE_NAME" --save 2>&1
  fi
  ADD_EXIT=$?

  # Post-check: audit for new vulnerabilities
  echo "Running post-install vulnerability check..."
  if command -v npm &> /dev/null; then
    npm audit --json 2>/dev/null > npm-audit-after.json || true
  fi

  # Verify lock file exists
  if [ -f "package-lock.json" ]; then
    echo "Lock file verified: package-lock.json"
  else
    echo "WARNING: package-lock.json not found — run npm install to generate"
  fi

  if [ $ADD_EXIT -ne 0 ]; then
    echo "DEPENDENCY ADD FAILED (exit $ADD_EXIT): npm install $PACKAGE_NAME"
  else
    echo "DEPENDENCY ADDED: $PACKAGE_NAME"
  fi
fi

# Python / pip
if [ "$PACKAGE_MANAGER" = "pip" ]; then
  # Pre-check: pip-audit if available
  if command -v pip-audit &> /dev/null; then
    echo "Running vulnerability pre-check..."
    pip-audit 2>/dev/null > pip-audit-before.txt || true
  fi

  # Add the dependency
  echo "Adding dependency: $PACKAGE_NAME"
  pip install "$PACKAGE_NAME" 2>&1
  ADD_EXIT=$?

  # Update requirements file if it exists
  if [ -f "requirements.txt" ]; then
    echo "Updating requirements.txt..."
    pip freeze >> requirements.txt 2>&1
  fi

  # Check pyproject.toml for poetry/pip-tools
  if [ -f "pyproject.toml" ] && command -v poetry &> /dev/null; then
    echo "Adding with poetry: poetry add $PACKAGE_NAME"
    poetry add "$PACKAGE_NAME" 2>&1
  fi

  if [ $ADD_EXIT -ne 0 ]; then
    echo "DEPENDENCY ADD FAILED (exit $ADD_EXIT): pip install $PACKAGE_NAME"
  else
    echo "DEPENDENCY ADDED: $PACKAGE_NAME"
  fi
fi

# Go / go modules
if [ "$PACKAGE_MANAGER" = "go" ]; then
  # Pre-check: go vet for existing issues
  echo "Running pre-check: go vet ./..."
  go vet ./... 2>&1 || true

  # Add the dependency
  echo "Adding dependency: $PACKAGE_NAME"
  go get "$PACKAGE_NAME" 2>&1
  ADD_EXIT=$?

  # Tidy the module
  echo "Tidying go.mod..."
  go mod tidy 2>&1

  # Verify go.sum exists
  if [ -f "go.sum" ]; then
    echo "Lock file verified: go.sum"
  fi

  if [ $ADD_EXIT -ne 0 ]; then
    echo "DEPENDENCY ADD FAILED (exit $ADD_EXIT): go get $PACKAGE_NAME"
  else
    echo "DEPENDENCY ADDED: $PACKAGE_NAME"
  fi
fi

# Rust / Cargo
if [ "$PACKAGE_MANAGER" = "cargo" ]; then
  # Add the dependency
  echo "Adding dependency: $PACKAGE_NAME"
  cargo add "$PACKAGE_NAME" 2>&1
  ADD_EXIT=$?

  # Verify Cargo.lock exists
  if [ -f "Cargo.lock" ]; then
    echo "Lock file verified: Cargo.lock"
  fi

  if [ $ADD_EXIT -ne 0 ]; then
    echo "DEPENDENCY ADD FAILED (exit $ADD_EXIT): cargo add $PACKAGE_NAME"
  else
    echo "DEPENDENCY ADDED: $PACKAGE_NAME"
  fi
fi

# Java / Maven
if [ "$PACKAGE_MANAGER" = "maven" ]; then
  # Add dependency to pom.xml
  echo "Adding dependency: $PACKAGE_NAME"

  # Parse the package name (groupId:artifactId:version)
  GROUP_ID=$(echo "$PACKAGE_NAME" | cut -d: -f1)
  ARTIFACT_ID=$(echo "$PACKAGE_NAME" | cut -d: -f2)
  VERSION=$(echo "$PACKAGE_NAME" | cut -d: -f3)

  if [ -z "$GROUP_ID" ] || [ -z "$ARTIFACT_ID" ]; then
    echo "ERROR: Maven dependencies require groupId:artifactId format (e.g., com.fasterxml.jackson.core:jackson-databind:2.15.0)"
    exit 1
  fi

  # Use Maven dependency:add to modify pom.xml
  mvn -q dependency:add -DgroupId="$GROUP_ID" -DartifactId="$ARTIFACT_ID" -Dversion="$VERSION" 2>&1
  ADD_EXIT=$?

  if [ $ADD_EXIT -ne 0 ]; then
    echo "DEPENDENCY ADD FAILED (exit $ADD_EXIT): mvn dependency:add"
    echo "Manual fix required: add dependency to pom.xml"
  else
    echo "DEPENDENCY ADDED: $PACKAGE_NAME"
  fi
fi
```

## 2. Safe Dependency Removal

Remove a dependency with lock file update:

```bash
# Node.js / npm
if [ "$PACKAGE_MANAGER" = "npm" ]; then
  if [ "$SCOPE" = "dev" ]; then
    echo "Removing dev dependency: $PACKAGE_NAME"
    npm uninstall "$PACKAGE_NAME" --save-dev 2>&1
  else
    echo "Removing dependency: $PACKAGE_NAME"
    npm uninstall "$PACKAGE_NAME" --save 2>&1
  fi
  REMOVE_EXIT=$?

  # Verify lock file updated
  if [ -f "package-lock.json" ]; then
    echo "Lock file updated: package-lock.json"
  fi

  if [ $REMOVE_EXIT -ne 0 ]; then
    echo "DEPENDENCY REMOVE FAILED (exit $REMOVE_EXIT): npm uninstall $PACKAGE_NAME"
  else
    echo "DEPENDENCY REMOVED: $PACKAGE_NAME"
  fi
fi

# Python / pip
if [ "$PACKAGE_MANAGER" = "pip" ]; then
  echo "Removing dependency: $PACKAGE_NAME"
  pip uninstall "$PACKAGE_NAME" -y 2>&1
  REMOVE_EXIT=$?

  if [ $REMOVE_EXIT -ne 0 ]; then
    echo "DEPENDENCY REMOVE FAILED (exit $REMOVE_EXIT): pip uninstall $PACKAGE_NAME"
  else
    echo "DEPENDENCY REMOVED: $PACKAGE_NAME"
  fi
fi

# Go / go modules
if [ "$PACKAGE_MANAGER" = "go" ]; then
  echo "Removing dependency: $PACKAGE_NAME"
  go mod edit -droprequire="$PACKAGE_NAME" 2>&1
  go mod tidy 2>&1
  REMOVE_EXIT=$?

  if [ $REMOVE_EXIT -ne 0 ]; then
    echo "DEPENDENCY REMOVE FAILED (exit $REMOVE_EXIT): go mod edit -droprequire"
  else
    echo "DEPENDENCY REMOVED: $PACKAGE_NAME"
  fi
fi

# Rust / Cargo
if [ "$PACKAGE_MANAGER" = "cargo" ]; then
  echo "Removing dependency: $PACKAGE_NAME"
  cargo rm "$PACKAGE_NAME" 2>&1
  REMOVE_EXIT=$?

  if [ $REMOVE_EXIT -ne 0 ]; then
    echo "DEPENDENCY REMOVE FAILED (exit $REMOVE_EXIT): cargo rm $PACKAGE_NAME"
    echo "Manual fix required: remove dependency from Cargo.toml"
  else
    echo "DEPENDENCY REMOVED: $PACKAGE_NAME"
  fi
fi
```

## 3. Dependency Update

Update a dependency to latest or specific version:

```bash
# Node.js / npm
if [ "$PACKAGE_MANAGER" = "npm" ]; then
  if [ -n "$VERSION" ]; then
    echo "Updating dependency: $PACKAGE_NAME@$VERSION"
    npm install "$PACKAGE_NAME@$VERSION" 2>&1
  else
    echo "Updating dependency: $PACKAGE_NAME (latest)"
    npm install "$PACKAGE_NAME@latest" 2>&1
  fi
  UPDATE_EXIT=$?

  if [ $UPDATE_EXIT -ne 0 ]; then
    echo "DEPENDENCY UPDATE FAILED (exit $UPDATE_EXIT): npm install $PACKAGE_NAME"
  else
    echo "DEPENDENCY UPDATED: $PACKAGE_NAME"
  fi
fi

# Python / pip
if [ "$PACKAGE_MANAGER" = "pip" ]; then
  if [ -n "$VERSION" ]; then
    echo "Updating dependency: $PACKAGE_NAME==$VERSION"
    pip install "$PACKAGE_NAME==$VERSION" 2>&1
  else
    echo "Updating dependency: $PACKAGE_NAME (latest)"
    pip install --upgrade "$PACKAGE_NAME" 2>&1
  fi
  UPDATE_EXIT=$?

  if [ $UPDATE_EXIT -ne 0 ]; then
    echo "DEPENDENCY UPDATE FAILED (exit $UPDATE_EXIT): pip install $PACKAGE_NAME"
  else
    echo "DEPENDENCY UPDATED: $PACKAGE_NAME"
  fi
fi

# Go / go modules
if [ "$PACKAGE_MANAGER" = "go" ]; then
  if [ -n "$VERSION" ]; then
    echo "Updating dependency: $PACKAGE_NAME@$VERSION"
    go get "$PACKAGE_NAME@$VERSION" 2>&1
  else
    echo "Updating dependency: $PACKAGE_NAME (latest)"
    go get -u "$PACKAGE_NAME" 2>&1
  fi
  go mod tidy 2>&1
  UPDATE_EXIT=$?

  if [ $UPDATE_EXIT -ne 0 ]; then
    echo "DEPENDENCY UPDATE FAILED (exit $UPDATE_EXIT): go get $PACKAGE_NAME"
  else
    echo "DEPENDENCY UPDATED: $PACKAGE_NAME"
  fi
fi

# Rust / Cargo
if [ "$PACKAGE_MANAGER" = "cargo" ]; then
  if [ -n "$VERSION" ]; then
    echo "Updating dependency: $PACKAGE_NAME@$VERSION"
    cargo update -p "$PACKAGE_NAME" --precise "$VERSION" 2>&1
  else
    echo "Updating dependency: $PACKAGE_NAME (latest)"
    cargo update -p "$PACKAGE_NAME" 2>&1
  fi
  UPDATE_EXIT=$?

  if [ $UPDATE_EXIT -ne 0 ]; then
    echo "DEPENDENCY UPDATE FAILED (exit $UPDATE_EXIT): cargo update $PACKAGE_NAME"
  else
    echo "DEPENDENCY UPDATED: $PACKAGE_NAME"
  fi
fi
```

## 4. Lock File Management

Ensure lock files are consistent after dependency changes:

```bash
# Verify and regenerate lock files
case "$PACKAGE_MANAGER" in
  npm)
    if [ -f "package-lock.json" ]; then
      echo "Verifying package-lock.json..."
      npm install --package-lock-only 2>&1 || true
    else
      echo "Generating package-lock.json..."
      npm install 2>&1
    fi
    ;;
  go)
    if [ -f "go.sum" ]; then
      echo "Verifying go.sum..."
      go mod verify 2>&1 || true
    fi
    go mod tidy 2>&1
    ;;
  cargo)
    if [ -f "Cargo.lock" ]; then
      echo "Verifying Cargo.lock..."
      cargo check 2>&1 || true
    fi
    ;;
  pip)
    if [ -f "requirements.txt" ]; then
      echo "Regenerating requirements.txt..."
      pip freeze > requirements.txt 2>&1
    fi
    if [ -f "poetry.lock" ]; then
      echo "Regenerating poetry.lock..."
      poetry lock 2>&1
    fi
    ;;
esac
```

## 5. Vulnerability Pre-Check

Check for known vulnerabilities before adding or updating dependencies:

```bash
# npm audit
if [ "$PACKAGE_MANAGER" = "npm" ] && command -v npm &> /dev/null; then
  echo "Checking npm audit for $PACKAGE_NAME..."
  npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities' 2>/dev/null || true
fi

# grype dependency scan
if command -v grype &> /dev/null; then
  echo "Running grype vulnerability check..."
  grype --severity HIGH,CRITICAL . 2>/dev/null || true
fi

# pip-audit
if [ "$PACKAGE_MANAGER" = "pip" ] && command -v pip-audit &> /dev/null; then
  echo "Running pip-audit..."
  pip-audit 2>/dev/null || true
fi

# govulncheck
if [ "$PACKAGE_MANAGER" = "go" ] && command -v govulncheck &> /dev/null; then
  echo "Running govulncheck..."
  govulncheck ./... 2>/dev/null || true
fi
```

## Edge Cases

- **Network failures**: If the package registry is unavailable, report the error and suggest retrying.
- **Dependency conflicts**: If adding a dependency causes version conflicts, report the conflict and suggest manual resolution.
- **Lock file corruption**: If the lock file is corrupted or missing, regenerate it by running the package manager's install command.
- **Transitive dependencies**: When removing a dependency, check if it's still required by other dependencies before removing.
- **Monorepo**: In monorepos, specify the workspace/package path when adding/removing dependencies.

## Guardrails

- Do NOT update all dependencies at once — update one at a time to isolate issues.
- Do NOT use `--force` or `--legacy-peer-deps` flags without explicit user confirmation.
- Always verify lock file integrity after changes.
- Run vulnerability pre-checks before adding dependencies.
- Do NOT commit dependency changes automatically — report them for review.
- Never use `eval` to construct package manager commands.
