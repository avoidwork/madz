# Contributing to Madz

Thanks for your interest in contributing! This document covers how to get started, development workflow, and project conventions.

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** (included with Node.js)
- An LLM provider API key (e.g., `OPENAI_API_KEY`)

### Installation

```bash
git clone https://github.com/avoidwork/madz.git
cd madz
npm install
```

### Running Tests

```bash
npm run test          # Run all tests
npm run coverage      # Generate coverage report (100% enforced)
npm run fix           # Auto-fix lint and format code
npm run lint          # Check lint and formatting
```

The pre-commit hook runs `oxfmt`, `oxlint`, tests, and coverage. A commit will fail if any gate does not pass.

---

## Development Workflow

### 1. Branching

```bash
git checkout -b feat/<short-desc>    # for new features
# or
git checkout -b fix/<short-desc>     # for bug fixes
```

- Never commit directly to `main`
- Always create a feature branch first, then open a PR targeting `main`
- Branch naming convention: `feat/…`, `fix/…`, `docs/…`

### 2. Code Changes

1. Implement your changes
2. Write or update tests in `tests/unit/` or `tests/integration/`
3. Run `npm run test` and `npm run coverage` locally before committing
4. Ensure 100% code coverage — the pre-commit hook enforces this

### 3. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add file upload endpoint with whitelist validation
fix: correct JWT audience claim validation
docs: update contributing guide
test: add unit tests for config loader
chore: pin dependencies in package.json
```

### 4. Pull Requests

1. Push your feature branch: `git push origin feat/<short-desc>`
2. Open a PR targeting `main`
3. Fill out every section of the PR template — do not leave any section blank
4. All automated checks (lint → test → coverage) must pass before merging

---

## Project Conventions

### Code Style

- **Language**: Plain JavaScript (ES modules), Node.js 24+
- **Formatting**: `oxfmt` (2-space indent, line-length 100)
- **Linting**: `oxlint` (strict config in `.oxlint.json`)
- **Testing**: `node --test` with `node:assert`
- **Type safety**: JSDoc annotations only (no TypeScript)

### Style Rules

- Private fields use `#` prefix (e.g., `#state`)
- Functions: `camelCase`, Constants: `UPPER_SNAKE_CASE`
- All public functions and classes MUST have JSDoc with `@param` and `@returns`
- Use `async/await` for all async code — no raw `.then()` chains
- Always attach timeouts to external HTTP/DB calls
- Never leave empty or silent `catch` blocks

### Forbidden Patterns

- Hardcoded secrets or API keys
- `console.log()` in production code (use structured logging)
- `eval()`, `new Function()`
- Wildcard exports (`export * from '...'`)
- Mutating a list while iterating over it
- Blocking I/O inside async functions

### Architecture Notes

- `config.yaml` + `src/config/loader.js` is the single source of truth for configuration
- All subsystems wire into `index.js` via `src/` modules
- Each public function or class needs test coverage
- Test files mirror source: `src/memory/reader.js` → `tests/unit/memory.test.js`

### Testing Guidelines

- Mock external services — no real API calls or network requests in tests
- Each public function or class must have at least one test
- Run `npm run coverage` to verify 100% coverage before committing
- If `coverage.txt` changes during commit, run `git add -A && git commit --amend -C HEAD`

---

## Security

This project follows [OWASP Top 10](https://owasp.org/www-project-top-10/) guidelines:

- All user input must be validated (prefer `zod` schemas)
- Never store plaintext secrets — use `process.env` or environment variables
- File uploads must pass whitelist + MIME validation
- Outbound tool URLs must be validated against an allowlist
- No `DEBUG=true` in non-local configurations

---

## Need Help?

- Check the [README](README.md) for setup and usage documentation
- Review the [Architecture Overview](docs/OVERVIEW.md) for subsystem details
- Open an issue for questions or feature requests
