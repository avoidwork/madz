# OWASP Top 10 — 2024

Reference for security scan findings. Use to cross-check and contextualize results from automated scanners (semgrep, gitleaks, trivy, npm audit, etc.).

## A01:2021 — Broken Access Control

Restrictions on authenticated users are not properly enforced. Attackers can escalate privilege to act outside their intended permissions.

**Common indicators:**
- Users can access other users' data (IDOR)
- Users can perform admin actions without admin role
- CORS misconfiguration allows cross-origin requests
- Default accounts with elevated privileges remain enabled

**Scanner rules:** `p/owasp#broken-access-control`, `p/owasp#idor`

---

## A02:2021 — Cryptographic Failures

Failure to protect sensitive data through proper cryptography.

**Common indicators:**
- Hardcoded encryption keys or secrets
- Use of weak algorithms (MD5, SHA1, DES, RC4)
- Insecure key storage (plaintext in config, environment variables without encryption)
- Missing encryption for data at rest or in transit

**Scanner rules:** `p/owasp#cryptographic-failures`, `p/owasp#hardcoded-secrets`

---

## A03:2021 — Injection

Injection of untrusted data that changes the intended execution flow.

**Common indicators:**
- SQL injection via string concatenation in queries
- Command injection via `exec()`, `spawn()`, backticks with user input
- LDAP injection, XML injection, template injection
- Missing parameterized queries or input sanitization

**Scanner rules:** `p/owasp#sql-injection`, `p/owasp#command-injection`, `p/owasp#template-injection`

---

## A04:2021 — Insecure Design

Missing or ineffective control design. This is distinct from insecure implementation.

**Common indicators:**
- No threat modeling for sensitive workflows
- Trusting client-side validation without server-side checks
- Insecure default configurations
- Lack of security requirements in the design phase

**Scanner rules:** N/A — primarily a design review concern

---

## A05:2021 — Security Misconfiguration

Insecure default configurations, incomplete setups, or exposed debug features.

**Common indicators:**
- Verbose error messages exposing stack traces
- Default credentials or passwords
- Unnecessary features or services enabled
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Cloud storage buckets with public access

**Scanner rules:** `p/owasp#security-misconfiguration`, `p/owasp#missing-security-headers`

---

## A06:2021 — Vulnerable and Outdated Components

Using components with known vulnerabilities, or components without proper support.

**Common indicators:**
- Dependencies with published CVEs (npm audit, pip-audit, govulncheck, cargo audit)
- End-of-life frameworks or runtimes
- Missing patch management process
- Transitive dependencies with vulnerabilities

**Scanner rules:** `npm audit`, `pip-audit`, `govulncheck`, `cargo audit`, `trivy`

---

## A07:2021 — Identification and Authentication Failures

Weaknesses in authentication, session management, or credential management.

**Common indicators:**
- Missing multi-factor authentication for sensitive actions
- Weak password policies
- Session tokens not invalidated on logout
- Predictable session IDs or tokens
- Missing account lockout or rate limiting

**Scanner rules:** `p/owasp#authentication`, `p/owasp#session-management`

---

## A08:2021 — Software and Data Integrity Failures

Failure to verify integrity of software updates, CI/CD pipelines, or deserialization processes.

**Common indicators:**
- Insecure deserialization of untrusted data
- Unsigned or unverified code updates
- CI/CD pipeline with insufficient access controls
- Insecure plugin or extension loading

**Scanner rules:** `p/owasp#deserialization`, `p/owasp#integrity`

---

## A09:2021 — Security Logging and Monitoring Failures

Insufficient logging, monitoring, or alerting on security-relevant events.

**Common indicators:**
- No logging of authentication failures
- Missing audit trails for privileged actions
- Logs not protected from tampering
- No alerting on suspicious activity patterns
- Structured logging without PII redaction

**Scanner rules:** N/A — primarily an operational review concern

---

## A10:2021 — Server-Side Request Forgery

Attacker exploits server to make requests to unintended internal or external resources.

**Common indicators:**
- URL fetching without allowlist validation
- SSRF via user-controlled URLs in API endpoints
- Internal network scanning via server-side requests
- Access to cloud metadata endpoints (e.g., `169.254.169.254`)

**Scanner rules:** `p/owasp#ssrf`

---

## How to Use This Reference

1. **Cross-check findings:** When a scanner reports a vulnerability, map it to the relevant OWASP category above.
2. **Assess severity:** Use the OWASP category context to determine if a finding is a true positive or false positive.
3. **Prioritize remediation:** A01–A03 are typically the most critical. A04 and A09 require design/operational reviews rather than code fixes.
4. **Document:** When creating issues for scanner findings, reference the OWASP category for context.
