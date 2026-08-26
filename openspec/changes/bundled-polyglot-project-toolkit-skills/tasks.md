## 1. Create project-context skill (MVP — full implementation)

- [ ] 1.1 Create `.skills/project-context/SKILL.md` with YAML frontmatter (name, description, metadata)
- [ ] 1.2 Implement language detection: scan for package.json, pom.xml, go.mod, pyproject.toml, Cargo.toml, build.gradle, Gemfile, package.yaml in priority order
- [ ] 1.3 Implement build system detection: map indicator files to build tools (npm → package.json.scripts, Maven → mvn, Go → go, etc.)
- [ ] 1.4 Implement test framework detection: check dependencies and config files for Jest, Vitest, JUnit, Node built-in test, pytest, etc.
- [ ] 1.5 Implement command extraction: extract build/test/lint/type-check commands from config files (package.json scripts, pom.xml plugins, go.mod, etc.)
- [ ] 1.6 Implement multi-language monorepo handling: report all detected languages with primary language based on priority
- [ ] 1.7 Implement tool availability check: verify ripgrep (rg) is available, fail gracefully with clear error message if missing
- [ ] 1.8 Document the skill's output format: structured summary with language, build system, test framework, and commands

## 2. Scaffold security-audit skill (structure only, documented intent)

- [ ] 2.1 Create `.skills/security-audit/SKILL.md` with YAML frontmatter (name, description, metadata)
- [ ] 2.2 Document dependency CVE scanning capability (trivy/grype) with tool availability checks
- [ ] 2.3 Document SAST scanning capability (semgrep) with language-appropriate rulesets
- [ ] 2.4 Document secret scanning capability (gitleaks) with tool availability checks
- [ ] 2.5 Document container scanning capability (trivy image) with Dockerfile detection
- [ ] 2.6 Document graceful degradation: each tool check fails with actionable error message
- [ ] 2.7 Document the skill's input/output contract: depends on project-context output

## 3. Scaffold build-run skill (structure only, documented intent)

- [ ] 3.1 Create `.skills/build-run/SKILL.md` with YAML frontmatter (name, description, metadata)
- [ ] 3.2 Document build command execution for each supported stack (npm, Maven, Go, etc.)
- [ ] 3.3 Document type-check execution for each language (TypeScript, Java, etc.)
- [ ] 3.4 Document lint execution for each language (oxlint, ruff, golangci-lint, etc.)
- [ ] 3.5 Document test execution for each test framework (Jest, Maven surefire, go test, etc.)
- [ ] 3.6 Document fallback behavior when commands are not defined
- [ ] 3.7 Document the skill's input/output contract: depends on project-context output

## 4. Scaffold dependency-manager skill (structure only, documented intent)

- [ ] 4.1 Create `.skills/dependency-manager/SKILL.md` with YAML frontmatter (name, description, metadata)
- [ ] 4.2 Document safe dependency addition for each package manager (npm install, Maven pom.xml edit, go get)
- [ ] 4.3 Document safe dependency removal for each package manager
- [ ] 4.4 Document lock file management (package-lock.json, Maven dependency:resolve, go.sum)
- [ ] 4.5 Document vulnerability pre-check before updates (npm audit, grype)
- [ ] 4.6 Document the skill's input/output contract: depends on project-context output

## 5. Scaffold test-env-setup skill (structure only, documented intent)

- [ ] 5.1 Create `.skills/test-env-setup/SKILL.md` with YAML frontmatter (name, description, metadata)
- [ ] 5.2 Document browser binary management (Playwright, Puppeteer)
- [ ] 5.3 Document test database setup (PostgreSQL, SQLite)
- [ ] 5.4 Document mock service configuration (SMTP, external APIs)
- [ ] 5.5 Document platform-specific considerations (Linux, macOS)
- [ ] 5.6 Document the skill's input/output contract: depends on project-context output

## 6. Update AGENTS.md

- [ ] 6.1 Add all 5 new skills to the Skills System section in AGENTS.md
- [ ] 6.2 Include skill descriptions matching the SKILL.md frontmatter descriptions
- [ ] 6.3 Note that these skills are bundled in `.skills/` alongside reflection
- [ ] 6.4 Document the skill pipeline: project-context → security-audit → build-run → dependency-manager → test-env-setup

## 7. Verify and lint

- [ ] 7.1 Run `npm run lint` to verify no linting errors
- [ ] 7.2 Run `npm run test` to verify all tests pass
- [ ] 7.3 Verify all SKILL.md files have valid YAML frontmatter
- [ ] 7.4 Verify AGENTS.md Skills System section lists all 5 new skills
