## 1. Create project-context skill (MVP — full implementation)

- [x] 1.1 Create `.skills/project-context/SKILL.md` with YAML frontmatter (name, description, metadata)
- [x] 1.2 Implement language detection: scan for package.json, pom.xml, go.mod, pyproject.toml, Cargo.toml, build.gradle, Gemfile, package.yaml in priority order
- [x] 1.3 Implement build system detection: map indicator files to build tools (npm → package.json.scripts, Maven → mvn, Go → go, etc.)
- [x] 1.4 Implement test framework detection: check dependencies and config files for Jest, Vitest, JUnit, Node built-in test, pytest, etc.
- [x] 1.5 Implement command extraction: extract build/test/lint/type-check commands from config files (package.json scripts, pom.xml plugins, go.mod, etc.)
- [x] 1.6 Implement multi-language monorepo handling: report all detected languages with primary language based on priority
- [x] 1.7 Implement tool availability check: verify ripgrep (rg) is available, fail gracefully with clear error message if missing
- [x] 1.8 Document the skill's output format: structured summary with language, build system, test framework, and commands

## 2. Scaffold security-audit skill (structure only, documented intent)

- [x] 2.1 Create `.skills/security-audit/SKILL.md` with YAML frontmatter (name, description, metadata)
- [x] 2.2 Document dependency CVE scanning capability (trivy/grype) with tool availability checks
- [x] 2.3 Document SAST scanning capability (semgrep) with language-appropriate rulesets
- [x] 2.4 Document secret scanning capability (gitleaks) with tool availability checks
- [x] 2.5 Document container scanning capability (trivy image) with Dockerfile detection
- [x] 2.6 Document graceful degradation: each tool check fails with actionable error message
- [x] 2.7 Document the skill's input/output contract: depends on project-context output

## 3. Scaffold build-run skill (structure only, documented intent)

- [x] 3.1 Create `.skills/build-run/SKILL.md` with YAML frontmatter (name, description, metadata)
- [x] 3.2 Document build command execution for each supported stack (npm, Maven, Go, etc.)
- [x] 3.3 Document type-check execution for each language (TypeScript, Java, etc.)
- [x] 3.4 Document lint execution for each language (oxlint, ruff, golangci-lint, etc.)
- [x] 3.5 Document test execution for each test framework (Jest, Maven surefire, go test, etc.)
- [x] 3.6 Document fallback behavior when commands are not defined
- [x] 3.7 Document the skill's input/output contract: depends on project-context output

## 4. Scaffold dependency-manager skill (structure only, documented intent)

- [x] 4.1 Create `.skills/dependency-manager/SKILL.md` with YAML frontmatter (name, description, metadata)
- [x] 4.2 Document safe dependency addition for each package manager (npm install, Maven pom.xml edit, go get)
- [x] 4.3 Document safe dependency removal for each package manager
- [x] 4.4 Document lock file management (package-lock.json, Maven dependency:resolve, go.sum)
- [x] 4.5 Document vulnerability pre-check before updates (npm audit, grype)
- [x] 4.6 Document the skill's input/output contract: depends on project-context output

## 5. Scaffold test-env-setup skill (structure only, documented intent)

- [x] 5.1 Create `.skills/test-env-setup/SKILL.md` with YAML frontmatter (name, description, metadata)
- [x] 5.2 Document browser binary management (Playwright, Puppeteer)
- [x] 5.3 Document test database setup (PostgreSQL, SQLite)
- [x] 5.4 Document mock service configuration (SMTP, external APIs)
- [x] 5.5 Document platform-specific considerations (Linux, macOS)
- [x] 5.6 Document the skill's input/output contract: depends on project-context output

## 6. Update AGENTS.md

- [x] 6.1 Add all 5 new skills to the Skills System section in AGENTS.md
- [x] 6.2 Include skill descriptions matching the SKILL.md frontmatter descriptions
- [x] 6.3 Note that these skills are bundled in `.skills/` alongside reflection
- [x] 6.4 Document the skill pipeline: project-context → security-audit → build-run → dependency-manager → test-env-setup

## 7. Verify and lint

- [x] 7.1 Run `npm run lint` to verify no linting errors
- [x] 7.2 Run `npm run test` to verify all tests pass
- [x] 7.3 Verify all SKILL.md files have valid YAML frontmatter
- [x] 7.4 Verify AGENTS.md Skills System section lists all 5 new skills
