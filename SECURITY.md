# Security Policy

## Supported Versions

Only the latest release of `madz` receives security updates. We strongly recommend keeping your installation up to date.

## Reporting a Vulnerability

We take the security of `madz` seriously. If you believe you have found a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.** This could expose the vulnerability to others before it has been addressed.
2. Email the maintainers directly at [your preferred contact method] with a detailed description of the vulnerability.
3. Allow reasonable time (at least 14 days) for the issue to be addressed before any public disclosure.

### What to Include

When reporting a vulnerability, please provide:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Your contact information for follow-up questions

## Security Practices

This project follows security best practices:

- **OWASP Top 10** — All routes pass through authentication middleware. No hardcoded secrets. Parameterized queries with validated user input via zod schemas.
- **Sandboxed Execution** — Skills run in isolated forked processes with time limits, memory caps, and allowlists for filesystem paths and outbound URLs.
- **Allowlisted Schemes** — Blocked schemes include `file://`, `gopher://`, `dict://`.
- **Authentication** — Supports `jwt`, `apikey`, and `none` (dev-only) modes. JWT enforces audience and issuer claims.
- **Telemetry Redaction** — Sensitive fields (API keys, auth headers) are automatically redacted from traces.
- **No Secret Exposure** — Secrets are only loaded from environment variables. Nothing is logged or hardcoded.

## Known Security Considerations

- LLM provider API keys must be provided via environment variables (`${VAR_NAME}` in `config.yaml` or direct env vars).
- Outbound HTTP from tools is filtered through an allowlist.
- Cron scheduler jobs inherit the current session's sandbox permissions — ensure permissions are appropriately scoped.

---

For more information on contributing security fixes, see [CONTRIBUTING.md](CONTRIBUTING.md#security).
