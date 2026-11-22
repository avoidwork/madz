# Rust Rule Catalog

Rules for `.rs` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | SQL injection (string concat in query) | high | `grep -rnE '(query\|execute)\s*\([^)]*\+'` |
| BUG-001 | bug | `unwrap()` / `expect()` on fallible result | high | `grep -rnE '\.unwrap\(\)|\.expect\('` |
| BUG-002 | bug | `panic!()` in non-test code | medium | `grep -rnE '\bpanic!\('` |
| BUG-003 | bug | `unwrap_or`/`unwrap_or_else` without default | medium | structural check (see below) |
| BUG-004 | bug | Unbounded loop (`loop {`) | medium | `grep -rnE '\bloop\s*\{'` |
| PERF-001 | performance | Blocking I/O in async context | medium | structural check (see below) |
| PERF-002 | performance | `.clone()` in hot path | low | `grep -rnE '\.clone\(\)'` |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| BUG-003 | A `Result`/`Option` is unwrapped with `unwrap_or`/`unwrap_or_else` but the fallback does not handle the error case meaningfully (e.g., returns a default that hides the error). |
| PERF-001 | An async function performs blocking I/O (`std::fs`, `std::io`) without `tokio`/`async-std` equivalents. |

## Best Practices

- **Error handling.** Prefer `Result`/`Option` and `?` operator; avoid `unwrap()`/`expect()` in production code.
- **Ownership.** Follow ownership and borrowing rules; prefer references over `.clone()`.
- **Concurrency.** Use `Arc`/`Mutex`/channels appropriately; avoid data races.
- **Formatting.** Run `cargo fmt`; follow `clippy` lints.
- **Doc comments.** Public items should have `///` doc comments.
- **No unsafe.** Minimize `unsafe` blocks; document why each is necessary.
