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
- Required tools (availability checked at runtime):
  - `trivy` (v0.50+) — container and dependency vulnerability scanning
  - `grype` (v0.70+) — dependency CVE scanning
  - `semgrep` (v1.0+) — language-agnostic SAST
  - `gitleaks` (v8.0+) — secret scanning
- Optional tools (used with graceful degradation if available):
  - `pip-audit` — Python dependency CVE scanning
  - `govulncheck` — Go vulnerability analysis
  - `cargo-audit` — Rust dependency security auditing
  - `eslint` — JavaScript/TypeScript linting (project uses oxlint by default)
  - `spotbugs` — Java static analysis (if configured in pom.xml)

Check tool availability before proceeding:

```bash
MISSING_TOOLS=()
for tool in trivy grype semgrep gitleaks; do
  if ! command -v "$tool" &> /dev/null; then
    MISSING_TOOLS+=("$tool")
  fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
  echo "WARNING: Missing security tools: ${MISSING_TOOLS[*]}"
  echo "Install with:"
  for tool in "${MISSING_TOOLS[@]}"; do
    case "$tool" in
      trivy)   echo "  trivy:   https://aquasecurity.github.io/trivy/latest/getting-started/installation/" ;;
      grype)   echo "  grype:   https://github.com/anchore/grype#install" ;;
      semgrep) echo "  semgrep: pip install semgrep" ;;
      gitleaks) echo "  gitleaks: https://github.com/gitleaks/gitleaks#install" ;;
    esac
  done
  echo "Proceeding with available tools only."
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
```

## 1. Dependency CVE Scanning

Run dependency vulnerability scanning using available tools:

```bash
# Trivy filesystem scan (dependency CVEs)
if command -v trivy &> /dev/null; then
  echo "Running trivy dependency scan..."
  trivy fs --severity HIGH,CRITICAL --format table . 2>/dev/null || true
fi

# Grype dependency scan (alternative/complement to trivy)
if command -v grype &> /dev/null; then
  echo "Running grype dependency scan..."
  grype . --severity HIGH,CRITICAL --format table 2>/dev/null || true
fi
```

Language-specific dependency scanning:

```bash
# Node.js — npm audit
if [ -f "package.json" ]; then
  echo "Running npm audit..."
  npm audit --json 2>/dev/null || true
fi

# Python — pip audit (if pip-audit is installed)
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
  if command -v pip-audit &> /dev/null; then
    echo "Running pip-audit..."
    pip-audit 2>/dev/null || true
  fi
fi

# Go — govulncheck
if [ -f "go.mod" ]; then
  if command -v govulncheck &> /dev/null; then
    echo "Running govulncheck..."
    govulncheck ./... 2>/dev/null || true
  fi
fi

# Rust — cargo audit
if [ -f "Cargo.toml" ]; then
  if command -v cargo-audit &> /dev/null; then
    echo "Running cargo audit..."
    cargo audit 2>/dev/null || true
  fi
fi
```

## 2. SAST Scanning

Run static application security testing with semgrep:

```bash
if command -v semgrep &> /dev/null; then
  echo "Running semgrep SAST scan..."

  # Run language-appropriate rulesets
  semgrep --config auto . 2>/dev/null || true

  # Run OWASP Top 10 ruleset
  semgrep --config p/security-audit . 2>/dev/null || true

  # Run strict mode for high-confidence findings
  semgrep --strict --config auto . 2>/dev/null || true
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

Run secret detection with gitleaks:

```bash
if command -v gitleaks &> /dev/null; then
  echo "Running gitleaks secret scan..."
  gitleaks detect --source . --report-format json --report-path gitleaks-report.json 2>/dev/null || true
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

Scan Docker images if a Dockerfile is present:

```bash
if [ -f "Dockerfile" ] || [ -f "Dockerfile.*" ]; then
  if command -v trivy &> /dev/null; then
    echo "Scanning Docker image..."
    # Build the image first if not already built
    docker build -t madz-scan . 2>/dev/null || true
    trivy image --severity HIGH,CRITICAL madz-scan 2>/dev/null || true
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
