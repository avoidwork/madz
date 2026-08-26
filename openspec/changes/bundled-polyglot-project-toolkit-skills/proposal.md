## Why

The agent currently operates as a blind shell operator: it can execute commands but doesn't understand the project's language, build system, or test framework. When an IC points the agent at a Jira epic, the agent has no way to detect what language the project uses, know which build tool to invoke, run the correct security scans, manage dependencies safely, or set up test environments. This creates friction and risk — the agent might run the wrong build command, miss security vulnerabilities, or fail silently.

## What Changes

- Create `project-context` skill (MVP) that detects project language, build system, test framework, and extracts commands from config files
- Scaffold four additional skills (security-audit, build-run, dependency-manager, test-env-setup) with proper structure and documented intent
- Update AGENTS.md Skills System section with all 5 new skills
- Document Dockerfile tool availability requirements for security scanning tools

## Capabilities

### New Capabilities
- `polyglot-discovery`: Detect project language, build system, test framework, and extract commands from config files (package.json, pom.xml, go.mod, etc.)
- `security-scanning`: Run dependency CVE scanning, SAST, secret scanning, and container scanning with graceful degradation when tools are missing
- `build-execution`: Execute build, type-check, lint, and test commands with correct flags for the detected stack
- `dependency-management`: Safely add, remove, or update dependencies with lock file management and vulnerability pre-checks
- `test-environment`: Manage test infrastructure including browser binaries, test databases, and mock services

### Modified Capabilities
<!-- None — no existing spec requirements are changing -->

## Impact

- New files in `.skills/` directory (5 SKILL.md files)
- AGENTS.md Skills System section updated
- No changes to existing source code, tools, or APIs
- Docker image may need tool additions (trivy, grype, semgrep, gitleaks, ripgrep, jq, yq) — documented but not implemented in MVP

## Non-goals

- Full implementation of security-audit, build-run, dependency-manager, and test-env-setup (scaffolded only)
- Docker image changes (documented but not implemented)
- Integration tests between skills (future work)
- Support for additional languages beyond the initial set
