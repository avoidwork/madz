# JavaScript / TypeScript Rule Catalog

Rules for `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret`/`access_key` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret\|access[_-]?key)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | `eval()` / `new Function()` / `__import__()` | critical | `grep -rnE 'eval\(|new Function\(|__import__\('` |
| SEC-003 | security | SQL injection (string concat in query) | high | `grep -rnE '(query\|sql)\s*.*\+\s*(req\|body\|params\|query)'` |
| SEC-004 | security | Route missing auth middleware | critical | structural check (see below) |
| SEC-006 | security | Plaintext secret stored outside `process.env` | high | `grep -rnE '(password\|secret\|api[_-]?key)\s*=\s*["'"']'` |
| BUG-001 | bug | Silent catch block | medium | `grep -rnE 'catch\s*\([^)]*\)\s*\{\s*\}'` |
| BUG-002 | bug | Unhandled promise (`.then(` without `.catch(`) | high | `grep -rnE '\.then\('` minus `.catch(` |
| BUG-003 | bug | `console.log` in production code | low | `grep -rn 'console\.log'` |
| BUG-004 | bug | Mutating a list while iterating | medium | structural check (see below) |
| BUG-005 | bug | Blocking I/O (`readFileSync`/`writeFileSync`) in async | medium | `grep -rnE 'readFileSync\|writeFileSync'` |
| BUG-006 | bug | Unbounded loop (`while (true)`) | medium | `grep -rnE 'while\s*\(\s*true\s*\)'` |
| PERF-001 | performance | Synchronous file I/O in async function | medium | `grep -rnE 'readFileSync\|writeFileSync'` |
| PERF-002 | performance | Wildcard import (`import *`) | low | `grep -rnE 'import\s*\*\s*from'` |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| SEC-004 | A route handler is defined (e.g., `app.get/post/put/delete(...)` or `router.get/post/...`) AND the handler does not reference the auth middleware (e.g., `auth`, `authenticate`, `requireAuth`, `verifyToken`) in its argument list or body. |
| BUG-004 | A `for...of`, `for...in`, `forEach`, or `while` loop iterates over an array/collection AND the loop body calls `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, or `reverse` on the same collection being iterated. |

## Best Practices

- **Async/await consistently.** Never mix blocking I/O in async contexts. Always attach a timeout to external HTTP or DB calls.
- **Error hierarchy.** Define domain-specific error classes extending `Error`; catch at the boundary, never swallow exceptions silently.
- **Structured logging.** Use a structured logger (e.g., pino), not `console.log`, in production code.
- **Parameterized queries.** Use an ORM with built-in escaping or parameterized queries. Validate and sanitize all user input via zod schemas.
- **No wildcard exports.** Avoid `export * from '...'`.
- **JSDoc on public APIs.** All public functions and classes must have JSDoc with `@param` and `@returns`.
