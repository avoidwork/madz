# Shell Rule Catalog

Rules for `.sh`, `.bash` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | Unquoted variable in command (word splitting) | high | `grep -rnE '\$\w+'` without quotes |
| BUG-001 | bug | `set -e` missing (errors not caught) | medium | structural check (see below) |
| BUG-002 | bug | Silent command failure (`cmd || true` or `2>/dev/null`) | medium | `grep -rnE '\|\|\s*true|2>\s*/dev/null'` |
| BUG-003 | bug | Unbounded loop (`while true`) | medium | `grep -rnE 'while\s+true'` |
| BUG-004 | bug | `echo` for logging in production | low | `grep -rnE '\becho\b'` |
| PERF-001 | performance | Subshell in loop (`$(...)` inside loop) | low | structural check (see below) |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| BUG-001 | A script does not start with `set -euo pipefail` (or `set -e`). |
| PERF-001 | A `for`/`while` loop invokes a command substitution `$(...)` or subshell `( ... )` on each iteration. |

## Best Practices

- **`set -euo pipefail`.** Always enable strict error handling at the top of the script.
- **Quote variables.** Always quote variable expansions (`"$VAR"`) to prevent word splitting and globbing.
- **Use `[[ ]]`.** Prefer `[[ ]]` over `[ ]` for conditionals in bash.
- **No `echo` for errors.** Use `printf` or a logging function; redirect errors to stderr.
- **Shellcheck.** Run `shellcheck` before shipping.
- **Idempotency.** Scripts should be safe to run multiple times.
