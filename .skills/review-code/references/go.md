# Go Rule Catalog

Rules for `.go` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | SQL injection (string concat in query) | high | `grep -rnE '(Query\|Exec)\s*\([^)]*\+'` |
| BUG-001 | bug | Ignored error (`_ =` or `err` unused) | high | `grep -rnE '_\s*=\s*[^=]+'` |
| BUG-002 | bug | Silent error handling (`if err != nil { return }` without log) | medium | structural check (see below) |
| BUG-003 | bug | `panic()` in non-recovery path | medium | `grep -rnE '\bpanic\('` |
| BUG-004 | bug | Unbounded loop (`for {`) | medium | `grep -rnE 'for\s*\{'` |
| PERF-001 | performance | Blocking I/O in goroutine without context | medium | structural check (see below) |
| PERF-002 | performance | Unbounded goroutine spawn | medium | `grep -rnE '\bgo\s+\w+\('` |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| BUG-002 | An `if err != nil` block returns without logging the error or wrapping it (no `log.`, `fmt.Errorf`, or `errors.Wrap` in the block). |
| PERF-001 | A goroutine (`go func()`) performs blocking I/O without a `context.Context` or timeout. |

## Best Practices

- **Error handling.** Always check and handle errors; never ignore them with `_ =`.
- **Context.** Pass `context.Context` as the first argument to functions that do I/O or network calls.
- **Goroutines.** Always use `sync.WaitGroup` or channels to manage goroutine lifecycle; avoid leaks.
- **Formatting.** Run `gofmt`; follow standard Go naming and package conventions.
- **Doc comments.** Exported functions and types must have doc comments starting with the symbol name.
- **No global mutable state.** Prefer dependency injection over package-level mutable variables.
