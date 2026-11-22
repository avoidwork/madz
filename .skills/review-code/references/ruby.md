# Ruby Rule Catalog

Rules for `.rb` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | `eval()` / `instance_eval()` / `class_eval()` | critical | `grep -rnE '\beval\(|\binstance_eval\(|\bclass_eval\('` |
| SEC-003 | security | SQL injection (string interpolation in query) | high | `grep -rnE '(execute\|query)\s*\([^)]*#\{'` |
| BUG-001 | bug | Silent rescue block | medium | `grep -rnE 'rescue\s*\n\s*(nil|#)'` |
| BUG-002 | bug | `puts`/`p` in production code | low | `grep -rnE '\bputs\b|\bp\s+\w'` |
| BUG-003 | bug | Unbounded loop (`loop do`) | medium | `grep -rnE '\bloop\s+do'` |
| BUG-004 | bug | Mutating array while iterating | medium | structural check (see below) |
| PERF-001 | performance | Blocking I/O in async context | medium | structural check (see below) |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| BUG-004 | A `each`/`map`/`each_with_index` loop iterates over an array AND the block calls `<<`, `push`, `pop`, `shift`, `unshift`, `delete`, or `delete_at` on the same array. |
| PERF-001 | A method uses blocking file I/O (`File.read`, `File.write`, `File.open`) inside an async/threaded context. |

## Best Practices

- **Symbols over strings.** Use symbols for identifiers and hash keys where appropriate.
- **Blocks and yield.** Prefer blocks and `yield` over manual iteration.
- **Parameterized queries.** Use an ORM (ActiveRecord) or parameterized queries; never interpolate user input into SQL.
- **Logging.** Use a logging library (e.g., `logger`), not `puts`, in production code.
- **RuboCop.** Follow RuboCop style conventions.
- **Documentation.** Public methods should have YARD doc comments.
