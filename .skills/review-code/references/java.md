# Java Rule Catalog

Rules for `.java` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | SQL injection (string concat in query) | high | `grep -rnE '(createQuery\|executeQuery\|prepareStatement)\s*\([^)]*\+'` |
| BUG-001 | bug | Empty catch block | medium | `grep -rnE 'catch\s*\([^)]*\)\s*\{\s*\}'` |
| BUG-002 | bug | `printStackTrace()` in production code | low | `grep -rnE 'printStackTrace\('` |
| BUG-003 | bug | `System.out.println` in production code | low | `grep -rnE 'System\.out\.println'` |
| BUG-004 | bug | Unbounded loop (`while (true)`) | medium | `grep -rnE 'while\s*\(\s*true\s*\)'` |
| BUG-005 | bug | `==` comparing objects instead of `.equals()` | medium | structural check (see below) |
| PERF-001 | performance | Blocking I/O in async context | medium | structural check (see below) |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| BUG-005 | A `==` or `!=` comparison is applied to two non-primitive object references (e.g., `String`, custom objects) where `.equals()` is intended. |

## Best Practices

- **Exception handling.** Catch specific exceptions, never `Exception` or `Throwable` broadly; log or re-throw, never swallow.
- **Parameterized queries.** Use `PreparedStatement` with bind parameters; never concatenate user input into SQL.
- **Logging.** Use a logging framework (SLF4J/Logback), not `System.out.println`.
- **Immutability.** Prefer `final` fields and immutable objects where possible.
- **Javadoc.** Public classes and methods should have Javadoc comments.
- **No raw types.** Use generics; avoid raw `List`, `Map`, etc.
