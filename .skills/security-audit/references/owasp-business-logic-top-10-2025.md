# OWASP Business Logic Abuse Top 10 — 2025 Reference

## Overview

Modern applications rely heavily on complex business logic to manage workflows, data, and user interactions. Unlike traditional vulnerabilities such as SQL injection or misconfigurations, business logic abuse exploits **design flaws** in how applications operate. These attacks manipulate application workflows, state transitions, and decision-making processes to gain unauthorized access, bypass restrictions, or disrupt operations.

The OWASP Business Logic Abuse Top 10 complements existing OWASP Top 10 projects by providing a cross-domain focus on business logic vulnerabilities that transcend technology stacks — applicable to web applications, APIs, mobile apps, firmware, supply chain systems, and hardware platforms.

This reference is organized by the computational model of applications as **Turing machines**:
- **Tape** — memory / data storage (databases, in-memory objects)
- **Head** — data access mechanisms (API calls, queries)
- **States** — application workflows (authentication, transaction approval)
- **Transitions** — logic that moves the application between states (user actions, API responses)

---

## BLA1:2025 — Action Limit Overrun (ALO)

**Description:** An operation intended to execute a limited number of times (e.g., redeeming a coupon, issuing a refund, granting a free trial) can be performed multiple times in quick succession due to a race condition between validation and execution (TOCTOU).

**Root Cause:** Multiple concurrent requests read the same stale "unused" state before any state update is committed, allowing each request to pass the check independently.

**Key Prevention Measures:**
- Use atomic operations (locks, transactions, optimistic concurrency) for idempotent or single-use operations.
- Implement request deduplication via payload fingerprinting or idempotency keys.
- Apply database-level constraints (e.g., unique indexes, row-level locks) to prevent duplicate execution.

**Notable Indicators:**
- Concurrent or near-simultaneous requests to the same endpoint with identical payloads.
- Counters that underflow or fail to decrement atomically.
- Absence of locking or transactional guards around state-changing operations.

**Mapped CWE:** CWE-367

---

## BLA2:2025 — Concurrent Workflow Order Bypass (CWOB)

**Description:** An attacker leverages a race condition to execute a final workflow step before its required prior steps have fully applied, bypassing mandatory checks such as multi-factor verification or email confirmation.

**Root Cause:** Business workflows spanning multiple services or internal stages lack a central orchestrator or atomic guard, allowing out-of-order execution.

**Key Prevention Measures:**
- Enforce workflow ordering through a saga coordinator or central orchestrator.
- Bundle multi-step transitions into atomic transactions.
- Use in-process synchronization to prevent overlapping requests from observing intermediate sub-states.

**Notable Indicators:**
- Final action completes before prerequisite steps are persisted.
- Distributed commands handled independently without sequencing guarantees.
- Transient flags or in-memory state used across steps without persistence.

**Mapped CWEs:** CWE-841, CWE-367, CWE-368

---

## BLA3:2025 — Object State Manipulations (OSM)

**Description:** APIs bind user-supplied data directly into internal objects without filtering allowed fields or validating types, enabling attackers to override protected properties such as roles, flags, or balances.

**Root Cause:** Mass assignment (writing entire client payloads without field filtering) and data-type smuggling (exploiting loose parsing rules to bypass type checks).

**Key Prevention Measures:**
- Use allowlists of permitted fields for every API endpoint (never bind entire payloads blindly).
- Enforce strict type checking and serialization/deserialization guards.
- Separate DTOs (data transfer objects) from domain entities to prevent internal property exposure.

**Notable Indicators:**
- Unexpected fields in request payloads that map to internal properties (e.g., `"role": "admin"`).
- String values accepted where numeric or boolean types are expected (e.g., `"1e4"` for amount).
- PATCH/PUT endpoints that apply all submitted fields without validation.

**Mapped CWEs:** CWE-1287, CWE-704, CWE-843, CWE-681, CWE-192

---

## BLA4:2025 — Malicious Logic Loop (MLL)

**Description:** APIs with automated business processes contain hidden triggers, endless loops, unchecked-input loops, or unbounded recursion that attackers exploit to exhaust CPU, memory, or crash services.

**Root Cause:** Missing loop bounds, inadequate recursion depth tracking, unchecked integer inputs controlling iterations, and hidden conditional logic triggered by specific inputs.

**Key Prevention Measures:**
- Enforce maximum loop bounds and recursion depth limits on all automated routines.
- Validate and cap user-controlled iteration parameters (page sizes, transaction counts, retry attempts).
- Implement input validation on all parameters that influence control flow.
- Add timeout guards and circuit breakers for long-running operations.

**Notable Indicators:**
- Endless loops triggered by crafted inputs (e.g., self-referential data structures).
- Unbounded recursion in parsers, handlers, or image processors.
- Hidden triggers activated by undocumented parameters or specific conditions.
- Extreme values in pagination or bulk-processing parameters.

**Mapped CWEs:** CWE-511, CWE-835, CWE-606, CWE-674

---

## BLA5:2025 — Artifact Lifetime Exploitation (ALE)

**Description:** One-time or short-lived resources (tokens, sessions, temporary files, OTPs) are not expired or revoked after their intended use, allowing attackers to capture and replay them.

**Root Cause:** APIs fail to mark artifacts as consumed or expired after first use, and lack strict checks on artifact state transitions (new → used → expired).

**Key Prevention Measures:**
- Immediately mark disposable artifacts (OTPs, download links, session tokens) as consumed upon use.
- Implement automatic expiration with short TTLs for all transient resources.
- Enforce server-side state validation — never trust client-held artifacts as proof of prior state.
- Clean up temporary files and invalidate sessions on logout or timeout.

**Notable Indicators:**
- OTPs or tokens that remain valid after successful use.
- Session cookies that persist after logout.
- Download links or one-time URLs that remain accessible indefinitely.
- Absence of state transition tracking on disposable resources.

**Mapped CWEs:** CWE-613, CWE-664, CWE-459, CWE-672

---

## BLA6:2025 — Missing Transition Validation (MTV)

**Description:** An API defers or omits essential checks during multi-step state changes, allowing attackers to bypass mandatory validations (e.g., second-factor checks, approval flags) by calling a later endpoint directly or racing the validation step.

**Root Cause:** Multi-step processes trust that prerequisites were met in earlier steps without re-checking on each invocation, or allow manipulation of transition indicators/flags sent as input.

**Key Prevention Measures:**
- Re-validate prerequisite conditions at every step of a multi-step workflow.
- Bundle prerequisite checks and final actions into atomic operations.
- Never trust client-supplied step flags, sequence numbers, or hidden form fields as proof of completed validation.
- Store transition state server-side with integrity guarantees.

**Notable Indicators:**
- Later endpoints accessible without completing earlier required steps.
- Client-controlled step indicators that can be forged or skipped.
- Validation steps that are not re-checked at the final action endpoint.
- Headers or parameters (e.g., `x-middleware-subrequest`) that bypass security middleware.

**Mapped CWEs:** CWE-288, CWE-841, CWE-691

---

## BLA7:2025 — Resource Quota Violation (RQV)

**Description:** Business applications expose endpoints that consume computational resources, trigger external services, or perform expensive operations without adequate throttling, allowing attackers to overwhelm services or cause financial damage.

**Root Cause:** Absence of rate limiting, usage quotas, or resource consumption monitoring per user or per API key.

**Key Prevention Measures:**
- Implement per-user and per-API-key rate limiting with configurable thresholds.
- Set consumption limits on expensive operations (file generation, email/SMS sending, third-party API calls).
- Use weighted rate limiting for operations with varying resource costs (e.g., GraphQL with cost scoring).
- Monitor and alert on abnormal resource consumption patterns.

**Notable Indicators:**
- Endpoints accepting unlimited requests without throttling.
- High-cost operations (AI inference, PDF generation) counted equally with lightweight operations.
- No per-user or per-key limits on bulk operations or data scraping endpoints.
- Resource consumption that scales linearly or exponentially with user input.

---

## BLA8:2025 — Internal State Disclosure (ISD)

**Description:** Systems display different messages, codes, visuals, or delays for valid versus invalid inputs, leaking protected business states through side channels that attackers exploit to enumerate accounts and map workflow logic.

**Root Cause:** UI feedback is tied directly to internal checks instead of being normalized, creating an oracle that confirms hidden states.

**Key Prevention Measures:**
- Standardize all user-facing outputs — use identical error messages and response formats for all validation failures.
- Remove timing differences by adding artificial delays or using constant-time comparison for sensitive checks.
- Avoid exposing implementation details in error messages (stack traces, validation notes).
- Ensure UI elements (links, fields, icons) do not reveal whether a resource or account exists.

**Notable Indicators:**
- Distinct error messages for different failure modes (e.g., "username not found" vs. "incorrect password").
- Timing variations between valid and invalid inputs (e.g., password hashing delay).
- UI elements that appear or disappear based on internal state (e.g., "resend activation" only for existing users).
- Status indicators (colors, icons) that differ for valid vs. invalid resources.

---

## BLA9:2025 — Broken Access Control (BAC)

**Description:** Business workflows relying on gated role validations are exploited when implementations omit or misapply role/permission checks, allowing attackers to manipulate role identifiers or permission assignments to perform unauthorized operations.

**Root Cause:** Endpoints accept requests without verifying caller privileges, or authorization logic trusts client-supplied parameters (e.g., `X-User-Role` headers).

**Key Prevention Measures:**
- Enforce server-side role and permission checks on every sensitive endpoint.
- Never trust client-supplied role, permission, or identity parameters.
- Apply least-privilege ACLs and audit for overly broad default permissions.
- Validate object ownership — ensure users can only access or modify their own resources (BOLA prevention).

**Notable Indicators:**
- Sensitive endpoints accessible with any valid authentication token.
- Authorization based on forgeable headers or query parameters.
- Identifier tampering in paths or payloads (e.g., `/orders/200` → `/orders/201`).
- Users able to modify their own permissions or escalate privileges.

**Mapped CWEs:** CWE-863, CWE-862, CWE-732, CWE-284, CWE-639

---

## BLA10:2025 — Shadow Function Abuse (SFA)

**Description:** Hidden or forgotten features (internal API endpoints, administrative operations, test utilities) remain active in production without proper security controls, allowing attackers to bypass safeguards or access unauthorized functionality.

**Root Cause:** Shadow functionality created by unauthorized teams, deprecated functionality left in production, or obscured capabilities discoverable through code inspection or automated scanning.

**Key Prevention Measures:**
- Maintain an inventory of all endpoints and remove unused or deprecated functionality.
- Apply the same security controls to internal/test endpoints as to public-facing ones.
- Regularly scan for undocumented endpoints and hidden parameters.
- Restrict access to administrative and internal interfaces by network or authentication.

**Notable Indicators:**
- Undocumented API endpoints or parameters accessible in production.
- Deprecated or test features still active in production code.
- Hidden admin parameters or alternate access paths (e.g., undocumented WebSocket endpoints).
- Functions discovered through code inspection, directory brute-forcing, or reverse engineering.

**Mapped CWEs:** CWE-288, CWE-912, CWE-1242, CWE-425

---

## Quick Reference Table

| # | ID | Category | Primary Threat | Key CWEs |
|---|----|----------|---------------|----------|
| 1 | BLA1 | Action Limit Overrun | TOCTOU race on idempotent ops | CWE-367 |
| 2 | BLA2 | Concurrent Workflow Order Bypass | Out-of-order workflow execution | CWE-841, CWE-367, CWE-368 |
| 3 | BLA3 | Object State Manipulations | Mass assignment / type smuggling | CWE-1287, CWE-704, CWE-843 |
| 4 | BLA4 | Malicious Logic Loop | Unbounded loops / recursion | CWE-511, CWE-835, CWE-674 |
| 5 | BLA5 | Artifact Lifetime Exploitation | Replay of unexpired artifacts | CWE-613, CWE-664, CWE-459 |
| 6 | BLA6 | Missing Transition Validation | Skipped multi-step checks | CWE-288, CWE-841, CWE-691 |
| 7 | BLA7 | Resource Quota Violation | Unthrottled resource consumption | — |
| 8 | BLA8 | Internal State Disclosure | Side-channel state leakage | — |
| 9 | BLA9 | Broken Access Control | Missing/misapplied authorization | CWE-284, CWE-639 |
| 10 | BLA10 | Shadow Function Abuse | Hidden/undocumented endpoints | CWE-288, CWE-912 |

---

*Source: OWASP Top 10 for Business Logic Abuse (2025). First release May 30, 2025, OWASP AppSec Global EU, Barcelona.*
