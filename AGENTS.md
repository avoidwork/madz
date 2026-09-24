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
- **Never amend a commit.** Use additional commits instead.
- Never force push.

### 1.4 Core Principles

- **DRY**: Extract repeated logic into functions, classes, or utilities. Centralize configuration in `config.js`. Reuse SSE envelope formatter, error handler, and auth middleware across modules. No copy-paste code blocks greater than three lines.
- **KISS**: Prefer simple, readable code over clever solutions. If a solution requires more than three levels of indentation or a helper function with more than 10 lines, reconsider it.
- **YAGNI**: Do NOT build features, abstractions, or configurations not required by the current spec. No generic "future-proof" wrappers. Ad-hoc solutions are acceptable as long as they serve a present requirement.
- **No Unneeded Refactoring**: Do not refactor working code for style, naming, or structure unless it directly addresses a bug, improves performance, or is required by the current spec. Refactoring without a clear purpose wastes time and introduces risk.
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
├── .oxlintrc.json              # oxlint configuration
├── .oxfmtrc.json               # oxfmt configuration
├── .oxfmtignore                # Files to ignore for formatting
├── .husky/                     # Husky git hooks directory
│   └── pre-commit              # Pre-commit hook script
├── coverage.txt                # Coverage report output
├── src/
│   ├── agent/                  # Deep Agents orchestrator, backends, agent definitions
│   │   ├── agentDefinitions.js
│   │   ├── agentRegistry.js
│   │   ├── contextBackend.js
│   │   ├── coreBackend.js
│   │   └── deepAgents.js
│   ├── config/                 # Configuration loading, validation, runtime mutation
│   │   ├── config.js
│   │   ├── loader.js
│   │   ├── patch.js
│   │   └── schemas/            # Zod schemas, one file per config section
│   ├── memory/                 # Markdown memory, context, profiles, GC
│   │   ├── context.js
│   │   ├── expireEphemeralMemories.js
│   │   ├── gc.js
│   │   ├── index.js
│   │   ├── profile.js
│   │   ├── prompts.js
│   │   ├── reader.js
│   │   ├── retention.js
│   │   ├── tools.js
│   │   └── writer.js
│   ├── provider/               # LLM model factory and token budgeting
│   │   ├── openai.js
│   │   ├── tokenBudget.js
│   │   └── tokenBudgetMiddleware.js
│   ├── sandbox/                # Path & URL validation for the tool layer
│   │   ├── pathResolver.js
│   │   └── urlFilter.js
│   ├── scheduler/              # Cron-based task scheduling
│   │   ├── cron.js
│   │   ├── index.js
│   │   └── scheduler.js
│   ├── session/                # Session state, checkpointing, onboarding
│   │   ├── checkpointer.js
│   │   ├── factory.js
│   │   ├── index.js
│   │   ├── loader.js
│   │   ├── onboarding.js
│   │   ├── saver.js
│   │   ├── shutdown.js
│   │   ├── stateManager.js
│   │   └── window.js
│   ├── shared/                 # Cross-cutting utilities
│   │   └── logger.js           # Structured logging (pino)
│   ├── skills/                 # Agent Skills spec discovery, validation & metadata
│   │   ├── agentMapper.js
│   │   ├── discoverer.js
│   │   ├── index.js
│   │   ├── registry.js
│   │   ├── types.js
│   │   └── validator.js
│   ├── stream/                 # Stream transformers
│   │   └── transformers/
│   │       ├── index.js
│   │       └── turn.js
│   ├── telemetry/              # OpenTelemetry observability
│   │   ├── flusher.js
│   │   ├── index.js
│   │   ├── llmInstrumenter.js
│   │   ├── metrics.js
│   │   ├── provider.js
│   │   ├── redaction.js
│   │   ├── sampler.js
│   │   └── skillInstrumenter.js
│   ├── tools/                  # Built-in LangChain tools (one directory per tool)
│   │   ├── index.js            # Tool registry, ORCHESTRATOR_TOOLS, buildToolConfig()
│   │   ├── common.js           # Shared path/URL validation helpers
│   │   ├── api/ calendar/ clarify/ code/ config/ cron/ data/ date/ dns/
│   │   ├── email/ fileExtract/ graphql/ image/ json/ memory/ pdf/ pptx/
│   │   ├── process/ reflection/ sampling/ scanAgents/ session/ skills/
│   │   ├── spreadsheet/ tts/ web/ webhook/ yaml/
│   │   └── ...                 # calendar/providers/, email/providers/ for backends
│   ├── tui/                    # Terminal user interface (Ink)
│   │   ├── app.js
│   │   ├── inputPanel.js
│   │   ├── conversationPanel.js
│   │   ├── skillsPanel.js
│   │   ├── memoryPanel.js
│   │   ├── settingsPanel.js
│   │   ├── commandParser.js
│   │   ├── panels.js
│   │   ├── messages.js
│   │   ├── hooks.js
│   │   └── ...                 # banner, messageBubble, messageList, statusBar,
│   │                           #   markdownText, inputArea, conversationArea, etc.
│   ├── vector/                 # Semantic code search (embeddings + sqlite-vec)
│   │   ├── chunker.js
│   │   ├── embedder.js
│   │   ├── indexer.js
│   │   ├── indexerWorker.js
│   │   └── store.js
│   └── workspace/              # AGENTS.md discovery
│       └── loadAgents.js
├── tests/                      # 142 test files; unit/ mirrors src/ structure
│   ├── unit/                   # Unit tests (config/, provider/, scheduler/, skills/,
│   │   │                       #   stream/transformers/, tools/, tui/, vector/, ...)
│   │   └── ...
│   ├── integration/            # Integration tests
│   │   ├── full-flow.test.js
│   │   ├── api.test.js
│   │   ├── webhook.test.js
│   │   ├── syncEnv.test.js
│   │   └── vector/
│   ├── tui/                    # TUI-specific tests
│   └── fixtures/               # Test fixtures
└── memory/                     # Persistent memory storage
    ├── checkpoints/            # SqliteSaver checkpoint database
    ├── context/                # Loaded context files
    ├── schedules/              # Scheduled job definitions
    ├── sessions/               # Session transcripts
    ├── tools/                  # Tool-persisted state
    └── vectorSearch/           # Vector index database
```

Misc details: The `config.yaml` file is the single source of project configuration, loaded by `src/config/loader.js`. All subsystems wire into the entry point `index.js` at the project root.

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
- **Linting**: `oxlint` (strict config in `.oxlintrc.json`)
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

The hook is `.husky/pre-commit`, installed by husky via the `prepare` npm script (`core.hooksPath` = `.husky/_`). Its body is:

```
npm run fix && npm run coverage && git add -A
```

Because the final step is `git add -A`, files the hook regenerates — `coverage.txt`, plus anything `oxlint --fix` or `oxfmt --write` rewrote — are staged automatically, so the commit proceeds and includes them. The commit does **not** fail merely because the hook modified a file.

Do not "fix" a hook-modified file by amending: §1.3 forbids amending outright. If a commit lands with content you did not intend to stage, add a follow-up commit instead.

**Gotcha:** `git add -A` stages the *entire* working tree, not just what you staged before committing. Anything untracked and not gitignored gets swept into the commit. Stage selectively and check `git status` before committing, or expect unrelated files to ride along.

### 6.3 Pre-commit Runs Tests

The hook gates on tests indirectly: `npm run coverage` runs `node --test` across the whole suite, and `set -o pipefail` propagates a test failure through the `grep`/redirect pipeline so the commit fails. Lint failures fail the commit via `npm run fix` (oxlint exits non-zero on errors it cannot auto-fix). A commit can therefore fail on lint errors or test failures.

There is no coverage *threshold* gate — the report is regenerated and committed, but no minimum is enforced. "Maintained coverage" is a review convention, not an automated check.

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

### 7.1 The filesystem is the source of truth for project layout

Neither `README.md` nor §2.0 above is authoritative — both drift as the code moves, and both have been wrong historically. When the layout matters, list the directory (`ls src/`, `find src -name '*.js'`) rather than trusting either document. §2.0 is maintained as a convenience map, not a contract.

### 7.2 Subagent tool lists must be reflected in the subagent description

The orchestrator learns what each subagent can do **only** through the subagent's `description` field. Deepagents renders it via `describeSubagentForTool()` as `- <name>: <description>`, and that is the entire picture the orchestrator gets when deciding whether to delegate.

When you add a tool to a subagent in `createSubagentDefinitions()` (`src/agent/deepAgents.js`), you **must** also append the tool list to that subagent's `description`. Otherwise the orchestrator has no idea the subagent carries the tool and will improvise — e.g., write a script to handle a `.docx` instead of delegating to the subagent that actually has the `docx` tool.

The `description` is built from `agentDef.description` (in `src/agent/agentDefinitions.js`); the tool list is derived from `filteredToolNames` via `getToolsForAgentTypes()`. Append it as a `Tools: <comma-separated list>` suffix, and omit the suffix when the subagent has no tools. The `tools` array (actual tool instances) is separate and unchanged — the description is what the orchestrator sees.

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
