# AGENTS.md

Rules and principles for agents working on **this** project.

---

## 1. Core Rules

### 1.0 Document Conventions

When updating this document, append new information or sections. Do NOT delete or overwrite existing content unless explicitly directed. Always ask before making structural changes. When in doubt, keep it.

### 1.1 Forbidden Patterns

The following are **strictly prohibited**:

- Hardcoded secrets, API keys, or credentials.
- `console.log()` statements in production code (use a structured logger instead).
- `catch (err) {}` empty or silent catch blocks.
- `eval()`, `new Function()`, `__import__()` at any level.
- Wildcard exports (`export * from '...'`).
- Mutating a list while iterating over it.
- Blocking operations (`fs.readFileSync`, `sync` HTTP clients) inside async functions.
- Bypassing the auth middleware.

### 1.2 Security Rules

Follow the [OWASP Top 10](https://owasp.org/www-project-top-10/) for every piece of code written:

- Every route MUST pass through authentication middleware.
- Never store plaintext secrets. Use `process.env` or a settings module loaded from env vars.
- Use parameterized queries or an ORM with built-in escaping. Validate and sanitize all user input via zod schemas.
- File uploads must pass whitelist + MIME validation.
- All settings defaults must be production-safe. No `DEBUG=true` in non-local configs.
- Implement secure token verification. Reject tokens with weak algorithms.
- Log at structured JSON level. Strip PII before logging.
- Validate all outbound tool URLs against an allowlist. Disallow `file://`, `gopher://`, `dict://` schemes.

### 1.3 Git Operations

- **Never rebase under any circumstance without explicit agreement from the user.** Never assume your decision is correct.
- **Never push to any branch without explicit user approval.** Git changes (checkout, reset, revert, amend) are local operations — do not auto-push. Always ask "Push to remote?" before running `git push`.
- Never force push.

### 1.4 Core Principles

- **DRY**: Extract repeated logic into functions, classes, or utilities. Centralize configuration in `config.js`. Reuse SSE envelope formatter, error handler, and auth middleware across modules. No copy-paste code blocks greater than three lines.
- **KISS**: Prefer simple, readable code over clever solutions. If a solution requires more than three levels of indentation or a helper function with more than 10 lines, reconsider it.
- **YAGNI**: Do NOT build features, abstractions, or configurations not required by the current spec. No generic "future-proof" wrappers. Ad-hoc solutions are acceptable as long as they serve a present requirement.
- **Single Responsibility**: Each module, class, and function must have one reason to change.
- **Open/Closed**: Extend via composition — not by modifying existing logic.
- **Dependency Inversion**: Depend on abstractions (interfaces / DI containers) for external services.

---

## 2. Project Context

Node.js-based AI harness application using LangGraph for state machines and OpenTelemetry for observability.

### 2.0 Expected Project Layout

```
/
├── index.js                    # Application entry point
├── package.json
├── config.yaml                 # Project configuration
├── .oxlint.json                # oxlint configuration
├── .oxfmtrc.json               # oxfmt configuration
├── .oxfmtignore                # Files to ignore for formatting
├── .husky/                     # Husky git hooks directory
│   └── pre-commit              # Pre-commit hook script
├── coverage.txt                # Coverage report output
├── src/
│   ├── config/                 # Configuration loading and validation
│   │   ├── loader.js
│   │   └── schemas.js
│   ├── memory/                 # Memory and conversation storage
│   │   ├── reader.js
│   │   ├── writer.js
│   │   ├── context.js
│   │   └── retention.js
│   ├── skills/                 # Agent Skills spec discovery, validation & permissions
│   │   ├── types.js
│   │   ├── validator.js
│   │   ├── registry.js
│   │   ├── permissions.js
│   │   ├── discoverer.js
│   │   └── index.js
│   ├── sandbox/                # Secure skill execution sandbox
│   │   ├── runner.js
│   │   ├── pathResolver.js
│   │   ├── urlFilter.js
│   │   ├── envInjector.js
│   │   ├── capability.js
│   │   └── timeoutHandler.js
│   ├── scheduler/              # Cron-based task scheduling
│   │   ├── parser.js
│   │   ├── queue.js
│   │   ├── runner.js
│   │   ├── logger.js
│   │   └── scheduler.js
│   ├── session/                # Session state management
│   │   ├── factory.js
│   │   ├── stateManager.js
│   │   ├── window.js
│   │   ├── loader.js
│   │   ├── saver.js
│   │   └── shutdown.js
│   ├── telemetry/              # OpenTelemetry observability
│   │   ├── provider.js
│   │   ├── redaction.js
│   │   ├── llmInstrumenter.js
│   │   ├── skillInstrumenter.js
│   │   ├── metrics.js
│   │   ├── sampler.js
│   │   └── flusher.js
│   └── tui/                    # Terminal user interface (Ink)
│       ├── app.js
│       ├── inputPanel.js
│       ├── conversationPanel.js
│       ├── skillsPanel.js
│       ├── memoryPanel.js
│       ├── settingsPanel.js
│       ├── commandParser.js
│       ├── panels.js
│       ├── messages.js
│       ├── hooks.js
│       └── components.js
├── tests/
│   ├── unit/                   # Unit tests mirroring src/ structure
│   │   ├── checkpointer.test.js
│   │   ├── config.test.js
│   │   ├── context.test.js
│   │   ├── conversationPanel.test.js
│   │   ├── discoverer.test.js
│   │   ├── filesystem.test.js
│   │   ├── memory.test.js
│   │   ├── onboarding.test.js
│   │   ├── profile.test.js
│   │   ├── provider.test.js
│   │   ├── react_agent.test.js
│   │   ├── reader.test.js
│   │   ├── registry.test.js
│   │   ├── sandbox.test.js
│   │   ├── scheduler.test.js
│   │   ├── session.test.js
│   │   ├── shutdown.test.js
│   │   ├── skills.test.js
│   │   ├── telemetry.test.js
│   │   ├── terminal.test.js
│   │   ├── tool_index.test.js
│   │   ├── tool_registration.test.js
│   │   ├── tools.test.js
│   │   ├── tools_clarify.test.js
│   │   ├── tools_code.test.js
│   │   ├── tools_cron.test.js
│   │   ├── tools_date.test.js
│   │   ├── tools_image.test.js
│   │   ├── tools_memory.test.js
│   │   ├── tools_moa.test.js
│   │   ├── tools_sampling.test.js
│   │   ├── tools_sessionSearch.test.js
│   │   ├── tools_tts.test.js
│   │   ├── tools_vision.test.js
│   │   ├── tools_web.test.js
│   │   └── tui.test.js
│   └── integration/            # Integration tests
│       └── full-flow.test.js
└── memory/                     # Persistent memory storage
    └── schedules/              # Scheduled job output files
```

Misc details: The `config.yaml` file is the single source of project configuration, loaded by `src/config/loader.js`. All subsystems wire into the entry point `index.js`.

### 2.1 Quick Commands

| Command               | Purpose                                        |
|-----------------------|------------------------------------------------|
| `npm run test`        | Run all tests                                  |
| `npm run coverage`    | Generate coverage report to `coverage.txt`     |
| `npm run fix`         | Auto-fix lint issues and format code           |
| `npm run lint`        | Check lint and formatting (no auto-fix)        |

---

## 3. Node.js / JavaScript Conventions

### 3.1 Language & Tooling

- **Node.js**: 24+ (ECMAScript modules, `package.json` `"type": "module"`)
- **Package manager**: `npm`
- **Type checking**: N/A (plain JavaScript)
- **Formatting**: `oxfmt` (line-length 100)
- **Linting**: `oxlint` (strict config in `oxlint.json`)
- **Testing**: `node --test` (built-in) or `vitest`
- **Git hooks**: `pre-commit` via Husky (manages oxfmt, oxlint, tests)

### 3.2 Style

- Use 2 spaces for indentation. No tabs. Maximum line length: 100 characters.
- Top-level const with `as const` for immutable values: `const STATUS = Object.freeze({ OK: 200 });`.
- All public functions and classes MUST have JSDoc comments with `@param` and `@returns`.
- Private fields prefixed with `#`.
- Functions: `camelCase`. Constants: `UPPER_SNAKE_CASE`.

### 3.3 Error Handling

- Use the `Error` hierarchy: define domain-specific error classes extending `Error`.
- Catch at the boundary (top-level error handler), not inside logic.
- Never swallow exceptions silently. Always log or re-throw.

```javascript
class AppError extends Error {
  constructor(message, code = 500) {
    super(message);
    this.code = code;
  }
}
```

### 3.4 Async

- Use `async/await` consistently. Never mix blocking I/O in async contexts.
- Always attach a timeout to external HTTP or DB calls.

```javascript
const [data, result] = await Promise.race([
  longOperation(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new TimeoutError()), TIMEOUT_MS)
  ),
]);
```

### 3.5 Testing

- Each public function or class must have at least one test.
- Tests live in `tests/unit/` for unit tests and `tests/integration/` for integration tests.
- Mock external services — no real API calls in tests.
- Test filenames mirror the source structure with `.test.js` extension.
  - `src/graphs/assistant_graph.js` → `tests/unit/graphs/assistant_graph.test.js`
  - `src/tools/workspace.js` → `tests/unit/tools/workspace.test.js`

---

## 4. Framework Conventions

### 4.1 LangGraph

- State must be a plain object or record; never use plain `any`.
- Use `PushMessage` / `AddMessage` annotations for message history. Keep state minimal.
- Each node is a plain `async function` receiving the state.
- Return an object of state updates. No side effects outside the returned object unless logged.
- Register tools explicitly with a clear input schema (e.g. zod object).
- Tools must NOT perform I/O without timeouts.

### 4.2 Auth Modes

- Modes: `jwt`, `apikey`, `none` (dev).
- API key auth uses `authApiKey` from app settings. Env var: `AUTH_API_KEY`.
- JWT auth uses JWKS endpoint for verification. Enforce audience and issuer claims.

---

## 5. Git Conventions

### 5.1 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add file upload endpoint with whitelist validation
fix: correct JWT audience claim validation
docs: update AGENTS.md with new config variables
test: add graph node unit tests for file_processor
chore: pin all dependencies in package.json
```

### 5.2 Branching

- Main branch is `main`.
- Feature branches: `feat/<short-desc>` or `fix/<short-desc>`.
- Never commit directly to `main`. Always create a feature branch first, then open a PR targeting `main`.

### 5.2.1 Agent Workflow

When auditing or modifying AGENTS.md (or any file):
1. Create a feature branch: `git checkout -b docs/<short-desc>` (or `feat/`, `fix/`).
2. Make changes and commit on the feature branch.
3. Push the feature branch and open a PR with `gh pr create --base main`.
4. Never commit or push directly to `main` or `master`.

### 5.3 Code Review

- All changes require at least one other reviewer (automated checks are mandatory but not sufficient).
- No merging without passing CI (lint → test).
- PR descriptions must reference related items from design documents.

### 5.4 Pull Request Templates

If a `.github/PULL_REQUEST_TEMPLATE.md` file exists, it MUST be used when creating PRs. Fill out every section — do not leave any section blank. If a section does not apply, write `N/A` rather than skipping it.

---

## 6. Operational Rules

Session learnings — critical gotchas that affect how code must be written and tested.

### 6.1 Coverage

The pre-commit hook enforces **maintained code coverage**. Every new function or class needs test coverage.

```bash
npm run coverage
```

Generates `coverage.txt` via `node --test --experimental-test-coverage`.

### 6.2 Pre-commit Hook and coverage.txt

The `cover` pre-commit hook runs `npm run coverage` then regenerates `coverage.txt`. If the hook modifies a staged file, `git commit` fails. Always `git add -A` and `git commit --amend -C HEAD` after a failed commit from a modified `coverage.txt`.

### 6.3 Pre-commit Runs Tests

The pre-commit hook runs `npm run test` and the coverage report in addition to linting. A commit can fail due to test failures or insufficient coverage, not just lint.

### 6.4 Mocking Settings

The `settings` singleton from `config.js` is the single source of configuration. When mocking:

- Replace the module, don't mutate properties of the singleton.
- Use `vi.mock()` (Vitest) or `jest.doMock()` to mock `config.js`.

```javascript
// Wrong: mutating the singleton leaks into other tests
config.settings.auth.apiKey = "secret";

// Right: replace the module entirely
vi.mock("./config.js", () => ({
  settings: { auth: { apiKey: "test-key" }, tools: { maxReadSize: 50 } },
}));
```

### 6.5 Mocking MongoDB

When mocking MongoDB, mock the collection methods directly. Every async call must return a proper promise.

```javascript
function makeDbMock(collections, docs) {
  const colMap = {};
  for (const name of collections) {
    colMap[name] = {
      find: () => ({
        limit: () => ({
          sort: () => ({
            toArray: () => Promise.resolve(docs[name] || []),
          }),
        }),
      }),
    };
  }
  return {
    listCollections: () => ({ toArray: () => Promise.resolve(collections.map(n => ({ name }))  }),
    db: (name) => colMap[name] || { find: () => ({ toArray: () => Promise.resolve([]) }) },
  };
}
```

### 6.6 Unreachable Code

Code that can never execute is a smell. Remove dead code to avoid coverage gaps and confusion.

---

## 7. Session Learnings

Discovery notes about the codebase.

### 7.1 README is the source of truth for project layout

The `README.md` may show a more up-to-date project structure (e.g., additional middleware modules, tool files). When in doubt, use it to verify the layout in section 2.0.

---

## 8. Checklist Before Marking a TODO Complete

- [ ] All JSDoc annotations present (`@param`, `@returns`) on public APIs.
- [ ] Unit tests written and passing.
- [ ] Integration tests for API endpoints.
- [ ] `oxlint` and `oxfmt` pass via pre-commit hooks.
- [ ] No hardcoded secrets or credentials introduced.
- [ ] Environment variable configuration used (no config file logic).
- [ ] Code coverage maintained (pre-commit will enforce this).
- [ ] Threat model considerations addressed in PR description.
