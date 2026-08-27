---
name: "security-audit"
description: "Run dev-time security scans appropriate for the detected stack — dependency CVEs, SAST, and secret scanning."
metadata:
  author: "madz"
  version: "1.0"
  agent: "security-audit"
---

# Security Audit Skill

Run dev-time security scans appropriate for the detected project stack. This skill depends on `project-context` output to determine which scans are relevant.

**Scope:** This skill runs dev-time security checks only. CI/CD pipeline scanning (trivy, semgrep, gitleaks, grype) is handled by the platform environment, not the dev container.

## Prerequisites

- **project-context skill** must be run first to detect the project stack
- **Available scanners** (all installed in the dev container):
  - `npm audit` — Node.js dependency CVE scanning (built into Node, always available)
  - `pip-audit` — Python dependency CVE scanning
  - `govulncheck` — Go vulnerability analysis
  - `cargo-audit` — Rust dependency security auditing
  - `oxlint` — JavaScript/TypeScript linting with security rules (project default)
  - `rg` (ripgrep) — pattern matching for secret detection

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

### Summary
- Total findings: <count>
- Critical: <count>
- High: <count>
- Medium: <count>
- Low: <count>

**Reference:** See `references/` for OWASP Top 10 categories to contextualize findings:

- `owasp-top-10-2025.md` — OWASP Top 10 2025 (current web app security)
- `owasp-llm-top-10-2025.md` — OWASP Top 10 for LLM Applications 2025
- `owasp-mcp-top-10-2025.md` — OWASP MCP Top 10 2025
- `owasp-business-logic-top-10-2025.md` — OWASP Business Logic Abuse Top 10 2025
```

## 1. Dependency CVE Scanning

Run language-specific dependency vulnerability scanning.

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

Run static application security testing using available tools.

```bash
# JavaScript/TypeScript — oxlint (project default)
if [ -f "package.json" ] && [ -f ".oxlint.json" ]; then
  if command -v npx &> /dev/null; then
    echo "Running oxlint security check..."
    timeout 120 npx oxlint --config .oxlint.json . 2>/dev/null || true
  fi
fi
```

## 3. Secret Scanning

Run secret detection using ripgrep pattern matching.

```bash
# Check for common secret patterns in config files
echo "Checking for hardcoded secrets..."
rg -n 'password\s*=\s*["\x27][^"\x27]+["\x27]' --type txt . 2>/dev/null || true
rg -n 'api[_-]?key\s*=\s*["\x27][^"\x27]+["\x27]' --type txt . 2>/dev/null || true
rg -n 'secret\s*=\s*["\x27][^"\x27]+["\x27]' --type txt . 2>/dev/null || true
```

## Graceful Degradation

Each tool check must fail with a clear, actionable error message:

```bash
# Example pattern for each tool
if ! command -v npm audit &> /dev/null; then
  echo "SKIP: npm audit not available — dependency CVE scanning unavailable"
else
  # Run npm audit
  ...
fi
```

At minimum, one scan type must succeed. If all tools are missing, report:

```
## Security Audit Results

No security tools available. The following tools are required:
- npm audit (built into Node.js)
- pip-audit (pip install pip-audit)
- govulncheck (go install golang.org/x/vuln/cmd/govulncheck@latest)
- cargo-audit (cargo install cargo-audit)

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
