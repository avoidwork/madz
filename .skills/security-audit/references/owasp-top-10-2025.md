# OWASP Top 10 2025 — Reference

> **Source:** [OWASP Top 10 2025](https://owasp.org/Top10/) — The Ten Most Critical Web Application Security Risks
> **Generated:** 2025

---

## Overview

The OWASP Top 10 is a standard awareness document for web application security. The 2025 edition is the 8th installment, based on analysis of ~220k CVEs mapped to ~589 CWEs across 2.8M+ applications, supplemented by community survey input. Two new categories were added (A03 Software Supply Chain Failures, A10 Mishandling of Exceptional Conditions) and one was consolidated (SSRF moved into A01 Broken Access Control). The ranking emphasizes root causes over symptoms.

---

## A01:2025 — Broken Access Control

**Rank:** #1 (highest prevalence — 100% of tested apps affected)

**Description:** Access control enforces policy so users cannot act outside their intended permissions. Failures lead to unauthorized information disclosure, modification, or destruction of data, or performing business functions outside user limits. Includes violation of least privilege, IDOR, SSRF, CSRF, elevation of privilege, CORS misconfiguration, and metadata manipulation (JWT/cookie tampering).

**Key Prevention Measures:**
- Deny by default except for public resources
- Implement access control once in trusted server-side code and reuse throughout
- Enforce record ownership in access models (not just CRUD flags)
- Disable directory listing; remove .git, backup files from web roots
- Log access control failures and alert on repeated failures
- Implement rate limits on API/controller access
- Invalidate stateful sessions on logout; use short-lived JWTs with refresh tokens
- Use well-established declarative access control toolkits

**Notable CWEs (40 total):** CWE-200, CWE-201, CWE-918 (SSRF), CWE-352 (CSRF), CWE-639 (IDOR), CWE-285 (Authorization Bypass), CWE-16 (Misconfiguration)

---

## A02:2025 — Security Misconfiguration

**Rank:** #2 (up from #5 in 2021)

**Description:** Security misconfiguration occurs when a system, application, or cloud service is set up incorrectly, creating vulnerabilities. Includes unnecessary features enabled, default credentials, excessive error messages, disabled security features on upgrades, insecure framework/library settings, missing security headers, and backward-compatibility compromises.

**Key Prevention Measures:**
- Implement a repeatable, automated hardening process for all environments (dev, QA, prod)
- Use minimal platform — remove unnecessary features, components, documentation, samples
- Review and update configurations as part of patch management; check cloud storage permissions
- Segment application architecture (containers, security groups, ACLs)
- Send security directives/headers to clients
- Automate configuration verification across all environments
- Proactively intercept excessive error messages centrally
- Use identity federation and short-lived credentials instead of static keys/secrets

**Notable CWEs (16 total):** CWE-16 (Configuration), CWE-611 (XXE), CWE-276 (Default Permissions), CWE-1104 (Unmaintained Components)

---

## A03:2025 — Software Supply Chain Failures

**Rank:** #3 (new — expanded from A06:2021 Vulnerable and Outdated Components)

**Description:** Breakdowns or compromises in the process of building, distributing, or updating software. Includes vulnerabilities or malicious changes in third-party code, tools, dependencies, CI/CD pipelines, IDEs, and distribution infrastructure. Highest average incidence rate (5.72%) but fewest CVEs due to testing challenges.

**Key Prevention Measures:**
- Centrally generate and manage a Software Bill of Materials (SBOM)
- Track direct and transitive dependencies continuously
- Remove unused dependencies, features, components, and files
- Continuously inventory component versions using tools (Dependency Track, Dependency Check, retire.js)
- Monitor CVE/NVD/OSV sources; use SCA and SBOM tools with alerts
- Obtain components only from official sources over secure links; prefer signed packages
- Deliberately choose dependency versions; upgrade only when needed
- Monitor for unmaintained libraries; deploy virtual patches if migration isn't possible
- Update CI/CD, IDE, and developer tooling regularly
- Use staged/canary deployments to limit exposure from compromised vendors

**Notable CWEs (6 total):** CWE-477 (Obsolete Function), CWE-1104 (Unmaintained Third Party), CWE-1329 (Non-Updateable Component), CWE-1395 (Vulnerable Third-Party Dependency)

---

## A04:2025 — Cryptographic Failures

**Rank:** #4 (down from #2 in 2021)

**Description:** Failures related to lack of cryptography, weak cryptography, leaked keys, and related errors. Includes weak algorithms/protocols, default/weak keys, keys in source code, missing encryption in transit/at rest, weak randomness, deprecated hashes (MD5/SHA1), padding oracle attacks, and crypto downgrade/bypass.

**Key Prevention Measures:**
- Classify and label data; identify sensitive data per privacy laws and regulations
- Store most sensitive keys in HSM or cloud-based HSM
- Use well-trusted cryptographic implementations
- Don't store sensitive data unnecessarily; use tokenization or truncation
- Encrypt all sensitive data at rest
- Use up-to-date, strong algorithms with proper key management
- Encrypt all data in transit with TLS 1.2+ (forward secrecy, no CBC, HSTS)
- Disable caching for sensitive responses (CDN, web server, application cache)
- Use strong password hashing: Argon2, yescrypt, scrypt, PBKDF2-HMAC-SHA-512 (bcrypt acceptable)
- Use appropriate IVs with CSPRNG; never reuse IVs with same key
- Always use authenticated encryption (AEAD)

**Notable CWEs (32 total):** CWE-327 (Broken Crypto), CWE-331 (Insufficient Entropy), CWE-1241 (Predictable RNG), CWE-338 (Weak PRNG), CWE-328 (Weak Hash), CWE-310 (Crypto Key Management)

---

## A05:2025 — Injection

**Rank:** #5 (down from #3 in 2021)

**Description:** An application flaw allowing untrusted input to be sent to an interpreter (browser, database, command line, etc.) and execute as commands. Includes SQL, NoSQL, OS command, ORM, LDAP, and EL/OGNL injection. 100% of tested apps affected; highest CVE count (62,445) of any category. Ranges from XSS (high frequency/low impact) to SQLi (low frequency/high impact).

**Key Prevention Measures:**
- **Preferred:** Use safe APIs with parameterized interfaces or ORM (avoids interpreter entirely)
- Use positive server-side input validation
- Escape special characters using the specific syntax for each interpreter
- Note: Parameterized stored procedures can still be vulnerable if they concatenate queries
- Combine source code review, automated testing (fuzzing), and SAST/DAST/IAST in CI/CD
- Never use user-supplied values for SQL structures (table names, column names)

**Notable CWEs (37 total):** CWE-89 (SQL Injection), CWE-79 (XSS), CWE-78 (OS Command Injection), CWE-918 (SSRF), CWE-909 (Missing Binding), CWE-564 (Hibernate Injection)

---

## A06:2025 — Insecure Design

**Rank:** #6 (down from #4 in 2021)

**Description:** Broad category representing missing or ineffective control design. Different from insecure implementation — design flaws cannot be fixed by perfect code. Includes lack of business risk profiling, missing threat modeling, and failure to determine required security design levels. Requires pre-code activities: requirements writing, application design, and secure development lifecycle.

**Key Prevention Measures:**
- Establish a secure development lifecycle with AppSec professionals
- Use a library of secure design patterns or paved-road components
- Apply threat modeling to critical flows (authentication, access control, business logic)
- Use threat modeling as an educational tool to build security mindset
- Integrate security language and controls into user stories
- Add plausibility checks at each application tier (frontend to backend)
- Write unit/integration tests validating threat model resistance (use-cases + misuse-cases)
- Segregate tier layers on system and network layers
- Robustly segregate tenants by design across all tiers

**Notable CWEs (39 total):** CWE-256 (Unprotected Credentials Storage), CWE-269 (Improper Privilege Management), CWE-434 (Unrestricted Upload), CWE-501 (Trust Boundary Violation), CWE-522 (Insufficiently Protected Credentials), CWE-840 (Business Logic Error)

---

## A07:2025 — Authentication Failures

**Rank:** #7 (maintained from 2021)

**Description:** When an attacker tricks a system into recognizing an invalid or incorrect user as legitimate. Includes credential stuffing, brute force, default/weak passwords, weak credential recovery, plain-text/weakly-hashed password stores, missing MFA, session identifier exposure, session fixation, and improper session invalidation.

**Key Prevention Measures:**
- Implement and enforce multi-factor authentication (MFA)
- Encourage password managers
- Never ship with default credentials
- Check passwords against top 10,000 worst passwords list
- Validate against known breached credentials (e.g., haveibeenpwned.com)
- Follow NIST 800-63b guidelines for password policies (no forced rotation unless breach suspected)
- Harden registration, recovery, and API paths against account enumeration (uniform error messages)
- Rate-limit or delay failed login attempts; log and alert on attacks
- Use server-side session manager with high-entropy random session IDs; rotate after login
- Store session IDs in secure cookies, not URLs; invalidate after logout/idle/absolute timeout
- Use well-trusted authentication/identity systems (e.g., OAuth, OIDC providers)
- Verify JWT claims (`aud`, `iss`, scopes)

**Notable CWEs (36 total):** CWE-259 (Hard-coded Password), CWE-287 (Improper Authentication), CWE-384 (Session Fixation), CWE-798 (Hard-coded Credentials), CWE-307 (Excessive Auth Attempts), CWE-613 (Insufficient Session Expiration)

---

## A08:2025 — Software or Data Integrity Failures

**Rank:** #8 (maintained from 2021)

**Description:** Failure to maintain trust boundaries and verify integrity of software, code, and data artifacts. Includes untrusted plugins/libraries/CDNs, insecure CI/CD pipelines, unsigned auto-updates, and insecure deserialization. Distinct from A03 — operates at a lower level than supply chain.

**Key Prevention Measures:**
- Use digital signatures to verify software/data origin and integrity
- Consume libraries only from trusted repositories; consider internal vetted repos
- Implement review process for code and configuration changes
- Ensure CI/CD pipeline has proper segregation, configuration, and access control
- Reject unsigned/unencrypted serialized data from untrusted clients; require integrity checks or signatures

**Notable CWEs (14 total):** CWE-829 (Untrusted Control Sphere), CWE-915 (Improperly Controlled Object Attributes), CWE-502 (Insecure Deserialization), CWE-345 (Insufficient Data Authenticity), CWE-353 (Missing Integrity Check), CWE-426 (Untrusted Search Path)

---

## A09:2025 — Security Logging & Alerting Failures

**Rank:** #9 (maintained from 2021)

**Description:** Without logging, monitoring, and alerting, attacks cannot be detected or responded to. Includes insufficient logging (only successful logins logged), inadequate error/warning messages, unprotected log integrity, lack of monitoring, local-only storage, missing alert thresholds, DAST scans not triggering alerts, sensitive data in logs, log injection, and false-positive overload.

**Key Prevention Measures:**
- Log all login, access control, and server-side input validation failures with user context
- Log every security control execution (success and failure)
- Generate logs in machine-consumable format
- Encode log data to prevent injection attacks on logging systems
- Implement append-only audit trails with integrity controls
- Roll back and restart failed transactions (fail closed)
- Issue alerts on suspicious application/user behavior
- Establish SOC playbooks and monitoring use cases
- Consider honeytokens to detect unauthorized access
- Establish incident response plans (e.g., NIST 800-61)

**Notable CWEs (5 total):** CWE-117 (Log Injection), CWE-532 (Info Leakage in Logs), CWE-778 (Insufficient Logging), CWE-780 (Timeout Error), CWE-781 (Improper Input Validation)

---

## A10:2025 — Mishandling of Exceptional Conditions

**Rank:** #10 (new for 2025)

**Description:** Programs failing to prevent, detect, and respond to unusual/unpredictable situations, leading to crashes, unexpected behavior, and vulnerabilities. Includes improper error handling, logical errors, failing open, missing input validation, late/high-level error handling, unexpected environmental states, and uncaught exceptions. Affects confidentiality, availability, and integrity.

**Key Prevention Measures:**
- Plan for the worst — catch every system error at its source
- Handle errors meaningfully and recover from issues
- Throw user-understandable errors, log events, and alert when justified
- Implement a global exception handler as fallback
- Use monitoring/observability to detect repeated errors indicating attacks
- Always roll back and restart transactions (fail closed) — never partially recover
- Add rate limiting, resource quotas, throttling, and other limits
- Deduplicate identical repeated errors above a threshold rate
- Use strict input validation with sanitization/escaping
- Centralize error handling, logging, monitoring, and alerting
- Perform threat modeling, code review, static analysis, and penetration testing

**Notable CWEs (24 total):** CWE-209 (Error Message Sensitive Info), CWE-234 (Missing Parameter), CWE-274 (Insufficient Privileges), CWE-476 (NULL Pointer Dereference), CWE-636 (Failing Open), CWE-248 (Uncaught Exception), CWE-703 (Improper Exception Handling), CWE-754 (Improper Check for Exceptional Conditions), CWE-460 (Improper Cleanup on Exception)

---

*This reference is for security scanning context only. See [OWASP Top 10 2025](https://owasp.org/Top10/) for full documentation.*
