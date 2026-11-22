# Python Rule Catalog

Rules for `.py`, `.pyi` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | `eval()` / `exec()` | critical | `grep -rnE '\beval\(|\bexec\('` |
| SEC-003 | security | SQL injection (string concat in query) | high | `grep -rnE '(execute\|executemany)\s*\([^)]*[+%]'` |
| SEC-006 | security | Plaintext secret stored outside env var | high | `grep -rnE '(password\|secret\|api[_-]?key)\s*=\s*["'"']'` |
| BUG-001 | bug | Mutable default argument | medium | `grep -rnE 'def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))'` |
| BUG-002 | bug | Bare `except:` (catches everything) | medium | `grep -rnE 'except\s*:'` |
| BUG-003 | bug | Silent `except` block | medium | `grep -rnE 'except[^:]*:\s*\n\s*(pass|\.\.\.)'` |
| BUG-004 | bug | `print()` in production code | low | `grep -rnE '\bprint\('` |
| BUG-005 | bug | Unbounded loop (`while True:`) | medium | `grep -rnE 'while\s+True\s*:'` |
| BUG-006 | bug | Blocking I/O in async function | medium | `grep -rnE '(open|read|write)\s*\('` in `async def` |
| PERF-001 | performance | Synchronous file I/O in async function | medium | `grep -rnE '(open\|read\|write)\s*\('` in `async def` |
| PERF-002 | performance | Wildcard import (`from x import *`) | low | `grep -rnE 'from\s+\w+\s+import\s+\*'` |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| QUAL-002 | A module-level `def`/`class` has no docstring (`"""..."""` or `'''...'''`) immediately following its definition line. |

## Best Practices

- **Type hints.** Use type annotations on public functions and classes.
- **Context managers.** Use `with` for file and resource handling; never leave resources unclosed.
- **Parameterized queries.** Use an ORM (SQLAlchemy) or parameterized queries; never f-string/format SQL with user input.
- **Logging module.** Use `logging`, not `print()`, in production code.
- **PEP 8.** Follow PEP 8 style; 4-space indentation, no tabs.
- **Docstrings.** Public modules, classes, and functions should have docstrings.
