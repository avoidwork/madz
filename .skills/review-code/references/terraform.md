# Terraform / HCL Rule Catalog

Rules for `.tf`, `.hcl` files. **Severity is fixed per rule — never a judgment call.**

| ID | Category | Rule | Severity | Detection |
|----|----------|------|----------|-----------|
| SEC-001 | security | Hardcoded secret (`password`/`api_key`/`token`/`secret` = literal) | critical | `grep -rnE '(password\|api[_-]?key\|token\|secret)\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-002 | security | Plaintext secret in variable default | high | `grep -rnE 'default\s*=\s*["'"'][^"'"']+["'"']'` |
| SEC-003 | security | Hardcoded credentials in provider block | critical | `grep -rnE '(access_key\|secret_key\|token)\s*=\s*["'"']'` |
| BUG-001 | bug | Unpinned provider version (`~>` or `=` missing) | medium | `grep -rnE 'source\s*=\s*["'"'][^"'"']+["'"']'` without version |
| BUG-002 | bug | Missing `required_version` constraint | medium | structural check (see below) |
| PERF-001 | performance | Unbounded `count`/`for_each` without condition | low | structural check (see below) |

## Structural Rules

| Rule | Detection criteria (all must hold) |
|------|-----------------------------------|
| BUG-002 | A `terraform` block exists but does not declare `required_version`. |
| PERF-001 | A `count`/`for_each` is used with a literal or unbounded value rather than a conditional or data source. |

## Best Practices

- **Pin versions.** Pin provider and module versions with `~>` or exact versions.
- **Variables over literals.** Use `variable` blocks with sensible defaults; never hardcode secrets.
- **Remote state.** Use remote state with locking; never commit local state files.
- **Formatting.** Run `terraform fmt`; follow HCL style conventions.
- **Validation.** Use `terraform validate` and `tflint` before applying.
- **No secrets in state.** Use `sensitive = true` on secret variables; never store secrets in plaintext.
