---
name: "security-audit"
description: "Run security scans appropriate for the detected stack — dependency CVEs, SAST, secret scanning, and container scanning with graceful degradation."
metadata:
  author: "madz"
  version: "1.0"
  agent: "coding"
---

# Security Audit Skill

Run security scans appropriate for the detected project stack. This skill depends on `project-context` output to determine which scans are relevant.

## Prerequisites

- **project-context skill** must be run first to detect the project stack
- **Language-specific scanners** (optional, used with graceful degradation):
  - `npm audit` — Node.js dependency CVE scanning (built into Node, always available)
  - `pip-audit` — Python dependency CVE scanning
  - `govulncheck` — Go vulnerability analysis
  - `cargo-audit` — Rust dependency security auditing
- **Security scanning tools** (optional, used with graceful degradation):
  - `trivy` — container and dependency vulnerability scanning
  - `semgrep` — language-agnostic SAST
  - `gitleaks` — secret scanning
  - `grype` — dependency CVE scanning

Check tool availability before proceeding:

```bash
MISSING_CI_TOOLS=()
for tool in trivy semgrep gitleaks grype; do
  if ! command -v "$tool" &> /dev/null; then
    MISSING_CI_TOOLS+=("$tool")
  fi
done

if [ ${#MISSING_CI_TOOLS[@]} -gt 0 ]; then
  echo "NOTE: CI/CD security tools not available in dev container (expected): ${MISSING_CI_TOOLS[*]}"
  echo "These tools belong in CI/CD pipelines, not the dev workspace."
  echo "Proceeding with available dev tools only."
fi
```

## Input/Output Contract

**Input**: Project context output from `project-context` skill (language, build system, package manager, indicator files).

**Output**: Structured security findings grouped by scan type:

```
## Security Audit Results

### Dependency CVEs
- [SEVERITY] <package>: <vulnerability> — <fix available: yes/no>

### SAST Findings
- [SEVERITY] <file>:<line> — <description>

### Secret Scanning
- [SEVERITY] <file> — <secret type>

### Container Scanning
- [SEVERITY] <image> — <vulnerability>

### Summary
- Total findings: <count>
- Critical: <count>
- High: <count>
- Medium: <count>
- Low: <count>

**Reference:** See `references/owasp-top-10.md` for OWASP Top 10 categories to contextualize findings.
```

## 1. Dependency CVE Scanning

Run language-specific dependency vulnerability scanning. These tools are useful in the dev environment for quick checks. CI/CD tools like `trivy` and `grype` are not expected in the dev container — they belong in the pipeline.

Language-specific dependency scanning:

```bash
# Node.js — npm audit (always available)
if [ -f "package.json" ]; then
  echo "Running npm audit..."
  npm audit --json 2>/dev/null || true
fi

# Python — pip audit (if installed)
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  if command -v pip-audit &> /dev/null; then
    echo "Running pip-audit..."
    pip-audit 2>/dev/null || true
  fi
fi

# Go — govulncheck (if installed)
if [ -f "go.mod" ]; then
  if command -v govulncheck &> /dev/null; then
    echo "Running govulncheck..."
    govulncheck ./... 2>/dev/null || true
  fi
fi

# Rust — cargo audit (if installed)
if [ -f "Cargo.toml" ]; then
  if command -v cargo-audit &> /dev/null; then
    echo "Running cargo audit..."
    cargo audit 2>/dev/null || true
  fi
fi
```

## 2. SAST Scanning

Run static application security testing. Note: `semgrep` is a CI/CD tool — it's not expected in the dev container. If the IC has it installed locally, great. Otherwise, skip it.

```bash
if command -v semgrep &> /dev/null; then
  echo "Running semgrep SAST scan..."

  # Run language-appropriate rulesets
  semgrep --config auto . 2>/dev/null || true

  # Run OWASP Top 10 ruleset
  semgrep --config p/security-audit . 2>/dev/null || true

  # Run strict mode for high-confidence findings
  semgrep --strict --config auto . 2>/dev/null || true
else
  echo "SKIP: semgrep not available — SAST scanning deferred to CI/CD pipeline"
fi
```

Language-specific SAST (if semgrep is not available):

```bash
# JavaScript/TypeScript — oxlint (project default)
if [ -f "package.json" ] && [ -f ".oxlint.json" ]; then
  if command -v npx &> /dev/null; then
    echo "Running oxlint security check..."
    timeout 120 npx oxlint --config .oxlint.json . 2>/dev/null || true
  fi
fi

# Java — spotbugs (if configured)
if [ -f "pom.xml" ] && grep -q 'spotbugs' pom.xml; then
  echo "Running spotbugs..."
  mvn spotbugs:check 2>/dev/null || true
fi
```

## 3. Secret Scanning

Run secret detection. Note: `gitleaks` is a CI/CD tool — not expected in the dev container. Use basic pattern matching as a fallback.

```bash
if command -v gitleaks &> /dev/null; then
  echo "Running gitleaks secret scan..."
  gitleaks detect --source . --report-format json --report-path gitleaks-report.json 2>/dev/null || true
else
  echo "SKIP: gitleaks not available — secret scanning deferred to CI/CD pipeline"
fi
```

Basic secret detection fallback (if gitleaks is not available):

```bash
# Check for common secret patterns in config files
echo "Checking for hardcoded secrets..."
rg -n 'password\s*=\s*["\x27][^"\x27]+["\x27]' --type txt . 2>/dev/null || true
rg -n 'api[_-]?key\s*=\s*["\x27][^"\x27]+["\x27]' --type txt . 2>/dev/null || true
rg -n 'secret\s*=\s*["\x27][^"\x27]+["\x27]' --type txt . 2>/dev/null || true
```

## 4. Container Scanning

Scan Docker images if a Dockerfile is present. Note: `trivy` is a CI/CD tool — not expected in the dev container.

```bash
if [ -f "Dockerfile" ] || [ -f "Dockerfile.*" ]; then
  if command -v trivy &> /dev/null; then
    echo "Scanning Docker image..."
    # Build the image first if not already built
    docker build -t madz-scan . 2>/dev/null || true
    trivy image --severity HIGH,CRITICAL madz-scan 2>/dev/null || true
  else
    echo "SKIP: trivy not available — container scanning deferred to CI/CD pipeline"
  fi
fi
```

## Graceful Degradation

Each tool check must fail with a clear, actionable error message:

```bash
# Example pattern for each tool
if ! command -v trivy &> /dev/null; then
  echo "SKIP: trivy not installed — dependency CVE scanning unavailable"
  echo "  Install: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
else
  # Run trivy scan
  ...
fi
```

At minimum, one scan type must succeed. If all tools are missing, report:

```
## Security Audit Results

No security tools available. The following tools are required:
- trivy (v0.50+): https://aquasecurity.github.io/trivy/latest/getting-started/installation/
- grype (v0.70+): https://github.com/anchore/grype#install
- semgrep (v1.0+): pip install semgrep
- gitleaks (v8.0+): https://github.com/gitleaks/gitleaks#install

Install at least one tool to run security scans.
```

## Edge Cases

- **No project context**: If `project-context` has not been run, request the user to run it first.
- **Large codebases**: Limit scan scope to relevant directories (e.g., `src/`, `lib/`).
- **False positives**: SAST tools may produce false positives. Report findings with severity and let the agent decide how to handle.
- **Network-dependent scans**: Some tools (npm audit, trivy) require network access. Handle network failures gracefully.

## Guardrails

- Do NOT fix security findings automatically — report them for the agent to review.
- Do NOT commit or modify files during scanning.
- Do NOT expose secret values in output — redact them (show only first/last 4 characters).
- Do NOT run scans with `--deep` or `--scan-all-packages` on large projects without user confirmation (may take a long time).
- Always use `--severity HIGH,CRITICAL` as the default filter to reduce noise.
