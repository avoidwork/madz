---
name: "project-context"
description: "Detect project language, build system, test framework, and extract commands from config files for polyglot project support."
metadata:
  author: "madz"
  version: "1.0"
  agent: "coding"
---

# Project Context Skill

Detect the project's language, build system, test framework, and extract relevant commands from configuration files. This is the foundation skill — all other polyglot skills depend on its output.

## Prerequisites

- **ripgrep (`rg`)** must be installed and available in PATH
- Read access to the project root directory

Check tool availability before proceeding:

```bash
if ! command -v rg &> /dev/null; then
  echo "ERROR: ripgrep (rg) is required but not installed. Install with: apt install ripgrep (Debian/Ubuntu), brew install ripgrep (macOS), or cargo install ripgrep (Rust)."
  exit 1
fi
```

## Steps

### 1. Scan for language indicators

Scan the project root (and common subdirectories for monorepos) for language indicator files in this priority order:

1. `package.json` → JavaScript/TypeScript (Node.js)
2. `pom.xml` → Java (Maven)
3. `go.mod` → Go
4. `pyproject.toml` or `requirements.txt` → Python
5. `Cargo.toml` → Rust
6. `build.gradle` or `build.gradle.kts` → Java/Kotlin (Gradle)
7. `Gemfile` → Ruby
8. `package.yaml` or `cabal.project` → Haskell

For each indicator file found, extract the language name and version if available:

```bash
# JavaScript/TypeScript — extract name and version from package.json
if [ -f "package.json" ]; then
  LANG_NAME=$(jq -r '.name // "unknown"' package.json 2>/dev/null || echo "unknown")
  LANG_VERSION=$(jq -r '.version // "unknown"' package.json 2>/dev/null || echo "unknown")
fi

# Java/Maven — extract groupId:artifactId from pom.xml
if [ -f "pom.xml" ]; then
  LANG_NAME=$(grep -oP '<artifactId>\K[^<]+' pom.xml | head -1 || echo "java")
  LANG_VERSION=$(grep -oP '<version>\K[^<]+' pom.xml | head -1 || echo "unknown")
fi

# Go — extract module path from go.mod
if [ -f "go.mod" ]; then
  LANG_NAME=$(head -1 go.mod | awk '{print $2}' || echo "go")
fi

# Python — extract name from pyproject.toml or requirements.txt
if [ -f "pyproject.toml" ]; then
  LANG_NAME=$(grep -oP '^name\s*=\s*"\K[^"]+' pyproject.toml | head -1 || echo "python")
elif [ -f "requirements.txt" ]; then
  LANG_NAME="python"
fi

# Rust — extract name from Cargo.toml
if [ -f "Cargo.toml" ]; then
  LANG_NAME=$(grep -oP '^name\s*=\s*"\K[^"]+' Cargo.toml | head -1 || echo "rust")
fi

# Gradle — detect from build.gradle or build.gradle.kts
if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  LANG_NAME="java"
fi

# Ruby — detect from Gemfile
if [ -f "Gemfile" ]; then
  LANG_NAME="ruby"
fi

# Haskell — detect from package.yaml or .cabal file
if [ -f "package.yaml" ] || ls *.cabal &>/dev/null; then
  LANG_NAME="haskell"
fi
```

### 2. Detect build system

Map the detected indicator files to build tools and extract build commands:

| Language | Indicator | Build Tool | Default Build Command |
|----------|-----------|------------|----------------------|
| JavaScript/TypeScript | `package.json` | npm/yarn/pnpm | `npm run build` (from scripts) |
| Java/Maven | `pom.xml` | Maven | `mvn package` |
| Go | `go.mod` | Go | `go build ./...` |
| Python | `pyproject.toml` | pip/setuptools | `pip install -e .` |
| Rust | `Cargo.toml` | Cargo | `cargo build` |
| Java/Kotlin | `build.gradle` | Gradle | `./gradlew build` |
| Ruby | `Gemfile` | Bundler | `bundle install` |
| Haskell | `package.yaml` | Cabal/Stack | `cabal build` |

Extract build commands from config files:

```bash
# Extract scripts from package.json
if [ -f "package.json" ]; then
  BUILD_CMD=$(jq -r '.scripts.build // .scripts.compile // "npm run build"' package.json 2>/dev/null || echo "npm run build")
fi

# Extract Maven goals from pom.xml
if [ -f "pom.xml" ]; then
  BUILD_CMD="mvn package"
fi

# Go build
if [ -f "go.mod" ]; then
  BUILD_CMD="go build ./..."
fi

# Cargo build
if [ -f "Cargo.toml" ]; then
  BUILD_CMD="cargo build"
fi

# Gradle build
if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  BUILD_CMD="./gradlew build"
fi
```

### 3. Detect test framework

Check dependencies and config files for test framework indicators:

```bash
# JavaScript/TypeScript test frameworks
if [ -f "package.json" ]; then
  DEPS=$(cat package.json)
  if echo "$DEPS" | grep -q '"jest"'; then
    TEST_FRAMEWORK="jest"
    TEST_CMD="npx jest"
  elif echo "$DEPS" | grep -q '"vitest"'; then
    TEST_FRAMEWORK="vitest"
    TEST_CMD="npx vitest"
  elif echo "$DEPS" | grep -q '"mocha"'; then
    TEST_FRAMEWORK="mocha"
    TEST_CMD="npx mocha"
  elif echo "$DEPS" | grep -q '"@playwright/test"'; then
    TEST_FRAMEWORK="playwright"
    TEST_CMD="npx playwright test"
  elif grep -q '"test":' package.json 2>/dev/null; then
    TEST_FRAMEWORK="node-builtin"
    TEST_CMD=$(jq -r '.scripts.test // "node --test"' package.json 2>/dev/null || echo "node --test")
  fi
fi

# Java test frameworks
if [ -f "pom.xml" ]; then
  if grep -q 'junit' pom.xml; then
    TEST_FRAMEWORK="junit"
    TEST_CMD="mvn test"
  fi
fi

# Go test
if [ -f "go.mod" ]; then
  TEST_FRAMEWORK="go-test"
  TEST_CMD="go test ./..."
fi

# Python test frameworks
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  if grep -q 'pytest' pyproject.toml requirements.txt 2>/dev/null; then
    TEST_FRAMEWORK="pytest"
    TEST_CMD="pytest"
  elif grep -q 'unittest' pyproject.toml requirements.txt 2>/dev/null; then
    TEST_FRAMEWORK="unittest"
    TEST_CMD="python -m unittest"
  fi
fi

# Rust test
if [ -f "Cargo.toml" ]; then
  TEST_FRAMEWORK="cargo-test"
  TEST_CMD="cargo test"
fi
```

### 4. Extract additional commands

Extract lint, type-check, and other useful commands:

```bash
# JavaScript/TypeScript — extract lint and type-check from package.json
if [ -f "package.json" ]; then
  LINT_CMD=$(jq -r '.scripts.lint // .scripts.eslint // "npx oxlint"' package.json 2>/dev/null || echo "npx oxlint")
  TYPECHECK_CMD=$(jq -r '.scripts.typecheck // .scripts.tsc // "npx tsc --noEmit"' package.json 2>/dev/null || echo "npx tsc --noEmit")
fi

# Java — lint via checkstyle or spotbugs (if configured in pom.xml)
if [ -f "pom.xml" ] && grep -q 'checkstyle' pom.xml; then
  LINT_CMD="mvn checkstyle:check"
fi

# Go — lint via golangci-lint
if [ -f "go.mod" ]; then
  if command -v golangci-lint &> /dev/null; then
    LINT_CMD="golangci-lint run"
  else
    LINT_CMD="go vet ./..."
  fi
fi

# Python — lint via ruff or flake8
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  if command -v ruff &> /dev/null; then
    LINT_CMD="ruff check ."
  elif command -v flake8 &> /dev/null; then
    LINT_CMD="flake8 ."
  fi
fi

# Rust — lint via clippy
if [ -f "Cargo.toml" ]; then
  LINT_CMD="cargo clippy -- -D warnings"
fi
```

### 5. Handle multi-language monorepos

When multiple language indicators are found, report all detected languages but use the primary language (first match in priority order) as the default:

```bash
# Collect all detected languages
DETECTED_LANGS=()
[ -f "package.json" ] && DETECTED_LANGS+=("javascript:package.json")
[ -f "pom.xml" ] && DETECTED_LANGS+=("java:pom.xml")
[ -f "go.mod" ] && DETECTED_LANGS+=("go:go.mod")
[ -f "pyproject.toml" ] && DETECTED_LANGS+=("python:pyproject.toml")
[ -f "Cargo.toml" ] && DETECTED_LANGS+=("rust:Cargo.toml")
[ -f "build.gradle" ] || [ -f "build.gradle.kts" ] && DETECTED_LANGS+=("java:build.gradle")
[ -f "Gemfile" ] && DETECTED_LANGS+=("ruby:Gemfile")
[ -f "package.yaml" ] && DETECTED_LANGS+=("haskell:package.yaml")

PRIMARY_LANG=${DETECTED_LANGS[0]:-"unknown"}
```

### 6. Output structured project context

Produce a structured summary in the following format:

```
## Project Context

- **Primary Language**: <language> (<version>)
- **All Detected Languages**: <comma-separated list>
- **Build System**: <build tool>
- **Build Command**: <command>
- **Test Framework**: <framework>
- **Test Command**: <command>
- **Lint Command**: <command>
- **Type Check Command**: <command>
- **Package Manager**: <npm/maven/go/pip/cargo/gradle/bundler>
- **Indicator Files**: <list of detected config files>
```

## Edge Cases

- **No language indicators found**: Report `Primary Language: unknown` with all indicator files empty. Suggest the user verify they are in the correct project directory.
- **Missing tools**: If `jq`, `rg`, or other tools are unavailable, fall back to `grep`/`sed`/`awk` for basic parsing. Log a warning but continue.
- **Monorepo with conflicting build systems**: Report all detected languages. The agent should decide how to handle polyglot projects.
- **Nested project roots**: For monorepos, scan common subdirectories (e.g., `packages/`, `apps/`, `services/`) for additional indicators.

## Guardrails

- Do NOT modify any project files — this skill is read-only.
- Do NOT execute build, test, or lint commands — only extract them.
- Do NOT assume a language is present just because a file exists — verify the file contains valid content (e.g., `package.json` must be valid JSON).
- Always fail gracefully with clear error messages if required tools are missing.
- Never use `eval` or construct commands from untrusted input.
