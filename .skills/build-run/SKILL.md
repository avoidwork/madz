---
name: "build-run"
description: "Execute build, type-check, lint, and test commands with correct flags for the detected project stack."
metadata:
  author: "madz"
  version: "1.0"
  agent: "coding"
---

# Build Run Skill

Execute build, type-check, lint, and test commands with the correct flags for the detected project stack. This skill depends on `project-context` output to determine which commands to run.

## Prerequisites

- **project-context skill** must be run first to detect the project stack
- The build/test/lint commands extracted by `project-context` must be available
- Required tools depend on the detected stack (e.g., `node`, `mvn`, `go`, `cargo`, `python`)

## Input/Output Contract

**Input**: Project context output from `project-context` skill (language, build system, commands).

**Output**: Structured execution results:

```
## Build/Run Results

### Build
- Command: <command>
- Exit Code: <code>
- Duration: <seconds>s
- Output: <last 50 lines or summary>

### Type Check
- Command: <command>
- Exit Code: <code>
- Duration: <seconds>s
- Output: <last 50 lines or summary>

### Lint
- Command: <command>
- Exit Code: <code>
- Duration: <seconds>s
- Output: <last 50 lines or summary>

### Test
- Command: <command>
- Exit Code: <code>
- Duration: <seconds>s
- Output: <last 50 lines or summary>
```

## 1. Build Command Execution

Execute the build command for the detected stack:

```bash
# Node.js / TypeScript
if [ "$PRIMARY_LANG" = "javascript" ] || [ "$PRIMARY_LANG" = "typescript" ]; then
  echo "Running build: $BUILD_CMD"
  timeout 300 bash -c "$BUILD_CMD" 2>&1
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUILD FAILED (exit $BUILD_EXIT): $BUILD_CMD"
  else
    echo "BUILD PASSED: $BUILD_CMD"
  fi
fi

# Java / Maven
if [ "$PRIMARY_LANG" = "java" ] && [ "$BUILD_SYSTEM" = "maven" ]; then
  echo "Running build: mvn package"
  timeout 600 mvn package -q 2>&1
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUILD FAILED (exit $BUILD_EXIT): mvn package"
  else
    echo "BUILD PASSED: mvn package"
  fi
fi

# Go
if [ "$PRIMARY_LANG" = "go" ]; then
  echo "Running build: go build ./..."
  timeout 300 go build ./... 2>&1
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUILD FAILED (exit $BUILD_EXIT): go build ./..."
  else
    echo "BUILD PASSED: go build ./..."
  fi
fi

# Rust / Cargo
if [ "$PRIMARY_LANG" = "rust" ]; then
  echo "Running build: cargo build"
  timeout 600 cargo build 2>&1
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUILD FAILED (exit $BUILD_EXIT): cargo build"
  else
    echo "BUILD PASSED: cargo build"
  fi
fi

# Python
if [ "$PRIMARY_LANG" = "python" ]; then
  echo "Running build: pip install -e ."
  timeout 300 pip install -e . 2>&1
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUILD FAILED (exit $BUILD_EXIT): pip install -e ."
  else
    echo "BUILD PASSED: pip install -e ."
  fi
fi

# Gradle
if [ "$PRIMARY_LANG" = "java" ] && [ "$BUILD_SYSTEM" = "gradle" ]; then
  echo "Running build: ./gradlew build"
  timeout 600 ./gradlew build 2>&1
  BUILD_EXIT=$?
  if [ $BUILD_EXIT -ne 0 ]; then
    echo "BUILD FAILED (exit $BUILD_EXIT): ./gradlew build"
  else
    echo "BUILD PASSED: ./gradlew build"
  fi
fi
```

## 2. Type-Check Execution

Run type-checking for languages that require it:

```bash
# TypeScript
if [ "$PRIMARY_LANG" = "typescript" ] || [ "$PRIMARY_LANG" = "javascript" ]; then
  if [ -f "tsconfig.json" ]; then
    echo "Running type check: npx tsc --noEmit"
    timeout 120 npx tsc --noEmit 2>&1
    TYPECHECK_EXIT=$?
    if [ $TYPECHECK_EXIT -ne 0 ]; then
      echo "TYPECHECK FAILED (exit $TYPECHECK_EXIT): npx tsc --noEmit"
    else
      echo "TYPECHECK PASSED: npx tsc --noEmit"
    fi
  fi
fi

# Java / Maven
if [ "$PRIMARY_LANG" = "java" ] && [ "$BUILD_SYSTEM" = "maven" ]; then
  echo "Running type check: mvn compile"
  timeout 300 mvn compile -q 2>&1
  TYPECHECK_EXIT=$?
  if [ $TYPECHECK_EXIT -ne 0 ]; then
    echo "TYPECHECK FAILED (exit $TYPECHECK_EXIT): mvn compile"
  else
    echo "TYPECHECK PASSED: mvn compile"
  fi
fi

# Rust / Cargo
if [ "$PRIMARY_LANG" = "rust" ]; then
  echo "Running type check: cargo check"
  timeout 300 cargo check 2>&1
  TYPECHECK_EXIT=$?
  if [ $TYPECHECK_EXIT -ne 0 ]; then
    echo "TYPECHECK FAILED (exit $TYPECHECK_EXIT): cargo check"
  else
    echo "TYPECHECK PASSED: cargo check"
  fi
fi

# Go
if [ "$PRIMARY_LANG" = "go" ]; then
  echo "Running type check: go vet ./..."
  timeout 120 go vet ./... 2>&1
  TYPECHECK_EXIT=$?
  if [ $TYPECHECK_EXIT -ne 0 ]; then
    echo "TYPECHECK FAILED (exit $TYPECHECK_EXIT): go vet ./..."
  else
    echo "TYPECHECK PASSED: go vet ./..."
  fi
fi
```

## 3. Lint Execution

Run linting for the detected stack:

```bash
# Node.js / TypeScript — oxlint (project default)
if [ "$PRIMARY_LANG" = "javascript" ] || [ "$PRIMARY_LANG" = "typescript" ]; then
  if [ -f ".oxlint.json" ]; then
    echo "Running lint: npx oxlint"
    timeout 120 npx oxlint 2>&1
    LINT_EXIT=$?
    if [ $LINT_EXIT -ne 0 ]; then
      echo "LINT FAILED (exit $LINT_EXIT): npx oxlint"
    else
      echo "LINT PASSED: npx oxlint"
    fi
  fi
fi

# Python — ruff or flake8
if [ "$PRIMARY_LANG" = "python" ]; then
  if command -v ruff &> /dev/null; then
    echo "Running lint: ruff check ."
    timeout 120 ruff check . 2>&1
    LINT_EXIT=$?
  elif command -v flake8 &> /dev/null; then
    echo "Running lint: flake8 ."
    timeout 120 flake8 . 2>&1
    LINT_EXIT=$?
  fi
  if [ "${LINT_EXIT:-0}" -ne 0 ]; then
    echo "LINT FAILED (exit $LINT_EXIT)"
  else
    echo "LINT PASSED"
  fi
fi

# Go — golangci-lint or go vet
if [ "$PRIMARY_LANG" = "go" ]; then
  if command -v golangci-lint &> /dev/null; then
    echo "Running lint: golangci-lint run"
    timeout 120 golangci-lint run 2>&1
    LINT_EXIT=$?
  else
    echo "Running lint: go vet ./..."
    timeout 120 go vet ./... 2>&1
    LINT_EXIT=$?
  fi
  if [ "${LINT_EXIT:-0}" -ne 0 ]; then
    echo "LINT FAILED (exit $LINT_EXIT)"
  else
    echo "LINT PASSED"
  fi
fi

# Rust — clippy
if [ "$PRIMARY_LANG" = "rust" ]; then
  echo "Running lint: cargo clippy -- -D warnings"
  timeout 300 cargo clippy -- -D warnings 2>&1
  LINT_EXIT=$?
  if [ $LINT_EXIT -ne 0 ]; then
    echo "LINT FAILED (exit $LINT_EXIT): cargo clippy -- -D warnings"
  else
    echo "LINT PASSED: cargo clippy -- -D warnings"
  fi
fi

# Java — checkstyle (if configured)
if [ "$PRIMARY_LANG" = "java" ] && [ -f "pom.xml" ] && grep -q 'checkstyle' pom.xml; then
  echo "Running lint: mvn checkstyle:check"
  timeout 120 mvn checkstyle:check 2>&1
  LINT_EXIT=$?
  if [ $LINT_EXIT -ne 0 ]; then
    echo "LINT FAILED (exit $LINT_EXIT): mvn checkstyle:check"
  else
    echo "LINT PASSED: mvn checkstyle:check"
  fi
fi
```

## 4. Test Execution

Run tests for the detected stack:

```bash
# Node.js / TypeScript — use detected test framework
if [ "$PRIMARY_LANG" = "javascript" ] || [ "$PRIMARY_LANG" = "typescript" ]; then
  echo "Running tests: $TEST_CMD"
  timeout 600 $TEST_CMD 2>&1
  TEST_EXIT=$?
  if [ $TEST_EXIT -ne 0 ]; then
    echo "TESTS FAILED (exit $TEST_EXIT): $TEST_CMD"
  else
    echo "TESTS PASSED: $TEST_CMD"
  fi
fi

# Java / Maven
if [ "$PRIMARY_LANG" = "java" ]; then
  echo "Running tests: mvn test"
  timeout 600 mvn test -q 2>&1
  TEST_EXIT=$?
  if [ $TEST_EXIT -ne 0 ]; then
    echo "TESTS FAILED (exit $TEST_EXIT): mvn test"
  else
    echo "TESTS PASSED: mvn test"
  fi
fi

# Go
if [ "$PRIMARY_LANG" = "go" ]; then
  echo "Running tests: go test ./..."
  timeout 300 go test ./... 2>&1
  TEST_EXIT=$?
  if [ $TEST_EXIT -ne 0 ]; then
    echo "TESTS FAILED (exit $TEST_EXIT): go test ./..."
  else
    echo "TESTS PASSED: go test ./..."
  fi
fi

# Rust / Cargo
if [ "$PRIMARY_LANG" = "rust" ]; then
  echo "Running tests: cargo test"
  timeout 600 cargo test 2>&1
  TEST_EXIT=$?
  if [ $TEST_EXIT -ne 0 ]; then
    echo "TESTS FAILED (exit $TEST_EXIT): cargo test"
  else
    echo "TESTS PASSED: cargo test"
  fi
fi

# Python
if [ "$PRIMARY_LANG" = "python" ]; then
  echo "Running tests: pytest"
  timeout 300 pytest 2>&1
  TEST_EXIT=$?
  if [ $TEST_EXIT -ne 0 ]; then
    echo "TESTS FAILED (exit $TEST_EXIT): pytest"
  else
    echo "TESTS PASSED: pytest"
  fi
fi
```

## 5. Fallback Behavior

When commands are not defined or tools are missing:

```bash
# If no build command was extracted, report and skip
if [ -z "$BUILD_CMD" ]; then
  echo "SKIP: No build command detected for this project."
  echo "  Run project-context first to extract commands from config files."
fi

# If a specific tool is missing, report and skip that step
if ! command -v node &> /dev/null && [ "$PRIMARY_LANG" = "javascript" ]; then
  echo "SKIP: node not found — cannot run JavaScript build/test commands"
fi

# If a command fails, report the exit code and last lines of output
run_with_output() {
  local cmd="$1"
  local label="$2"
  local timeout_sec="${3:-300}"
  local output
  output=$(timeout "$timeout_sec" bash -c "$cmd" 2>&1)
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "$label FAILED (exit $exit_code): $cmd"
    echo "Last 20 lines of output:"
    echo "$output" | tail -20
  else
    echo "$label PASSED: $cmd"
  fi
}
```

## Edge Cases

- **Build failure**: Report the exit code and last 20 lines of output. Do NOT attempt to fix build issues automatically.
- **Missing dependencies**: If `node_modules/`, `.m2/`, `vendor/`, etc. are missing, suggest running the package manager's install command first.
- **Long-running commands**: Use `timeout` to prevent hangs. Default timeout is 300s (5 minutes), 600s (10 minutes) for build/test.
- **Parallel execution**: Do NOT run build, type-check, lint, and test in parallel — they may conflict on file system resources.
- **Monorepo**: For monorepos, run commands at the workspace root. If workspace-specific commands are needed, the agent should specify the subdirectory.

## Guardrails

- Do NOT modify project files during build/test/lint execution.
- Do NOT run commands with `--force` or `--unsafe` flags without explicit user confirmation.
- Always use `timeout` to prevent hanging commands.
- Do NOT run test commands with `--coverage` or `--all` flags on large projects without user confirmation (may take a long time).
- Report all exit codes — even if a step "passes", note the exit code for debugging.
- Never use `eval` to construct or execute commands.
