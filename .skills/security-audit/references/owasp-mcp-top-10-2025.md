# OWASP MCP Top 10 — 2025 Reference

> **Source:** [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/) | **License:** CC BY-NC-SA 4.0
> **Status:** Beta (Phase 3) | **Next Release:** October 2026

## Overview

As AI systems become increasingly integrated into software supply chains, enterprise applications, and security infrastructure, the need for structured, secure, and interpretable model interaction layers is paramount. The Model Context Protocol (MCP) is emerging as a framework to define the operational, contextual, and behavioral boundaries of AI models. However, with the power and flexibility of MCPs comes a new class of vulnerabilities and attack surfaces that remain underexplored.

The OWASP MCP Top 10 outlines the most critical security concerns arising in the lifecycle of MCP-enabled systems — spanning from model misbinding, context spoofing, and prompt-state manipulation to insecure memory references and covert channel abuse. These risks are amplified in scenarios involving agentic AI, model chaining, multi-modal orchestration, and dynamic role assignment.

---

## MCP01:2025 — Token Mismanagement & Secret Exposure

**Description:** Tokens and credentials serve as the primary means of authentication and authorization between models, tools, and servers. Developers frequently mishandle these secrets — embedding them in configuration files, environment variables, prompt templates, or allowing them to persist within model context memory. Since MCP enables long-lived sessions and context persistence, tokens can be inadvertently stored, indexed, or retrieved later through user prompts, system recalls, or log inspection, resulting in contextual secret leakage.

**Is the Application Vulnerable?**
- Tokens or API keys are hard-coded in MCP client, server, or tool configurations.
- Models or agents retain conversational memory that includes secrets.
- Logs, telemetry, or vector stores record full prompts or responses without redaction.
- Token lifetimes exceed session duration or lack enforced rotation.
- The system relies on shared or static service accounts instead of user-scoped credentials.

**Key Prevention Measures:**
- Store secrets in secure vaults (HashiCorp Vault, AWS Secrets Manager); inject at runtime only.
- Issue short-lived, scoped tokens aligned with least privilege; require renewal per session.
- Bind tokens to specific agent, tool, or session context.
- Prevent sensitive data persistence in model memory or context windows.
- Redact or sanitize inputs and outputs before logging.
- Use ephemeral contexts for operations involving credentials.
- Redact or mask secrets before writing to logs or telemetry.
- Store diagnostic traces in protected locations with strict access control.
- Rotate and invalidate all tokens immediately upon suspected exposure.
- Define organizational policies for credential lifecycle management; use HSMs or Secrets Managers.

---

## MCP02:2025 — Privilege Escalation via Scope Creep

**Description:** Scope creep occurs when temporary or narrowly scoped permissions granted to an MCP agent or tool are expanded over time — intentionally for convenience or accidentally through configuration drift — until the agent holds broad or administrative privileges. Because MCP deployments frequently connect models to multiple systems, small cumulative scope increases can transform a low-risk automation into a high-impact attack surface.

**Is the Application Vulnerable?**
- Permissions are modified manually in development or prod without automated change logs.
- Service/agent accounts are shared across teams or sessions (no per-agent identity).
- There is no enforced expiration for scopes or tokens.
- Ad-hoc testing changes are promoted to production without approval gates.
- There is limited visibility into which agent invoked which action (weak or missing attribution).
- No automated entitlement/permission review process exists.

**Key Prevention Measures:**
- Define minimal permissions required per agent before deployment; use fine-grained scopes.
- Encode permission policies as code (Rego, OPA, Terraform IAM) and enforce in CI/CD.
- Issue time-limited scopes/tokens; use JIT elevation with approval gates.
- Assign unique identities to agents; bind credentials to agent and session context.
- Run periodic entitlement audits; alert on permission increases requiring justification.
- Implement runtime policy enforcement (PDP/PIP) to block disallowed commands or tool calls.
- Apply action whitelists, safe execution sandboxes, and multi-step confirmation for high-impact operations.
- Track all permission changes; keep immutable, tamper-evident logs tying actions to agent identity.
- Separate the authority to grant permissions from the authority to deploy or change production.

---

## MCP03:2025 — Tool Poisoning

**Description:** Schema poisoning occurs when an adversary tampers with the contract or schema definitions that govern agent-to-tool interactions in an MCP ecosystem. Schemas define the shape, types, and semantics of requests and responses — effectively the "language" agents use to call tools. If an attacker can modify a schema so that a benign-sounding operation maps to a destructive action, agents that trust and follow the schema may inadvertently execute dangerous commands. This is a supply-chain style compromise.

**Is the Application Vulnerable?**
- Schemas, manifests, or tool descriptors are fetched dynamically from remote locations without integrity checks.
- There is a writable schema registry or repository that lacks RBAC, code-review, or approvals.
- Schema edits are promoted to production automatically via CI/CD without signed commits or attestations.
- Agents accept and act on schema changes at runtime without operator confirmation.
- There is no provenance or version binding stored with the schema.
- No testing or contract verification exists that asserts semantic invariants.

**Key Prevention Measures:**
- Digitally sign schemas and tool manifests (JWS / COSE / PKI); verify before accepting.
- Use content-addressable identifiers (hashes) for schema versions; validate against trusted hashes.
- Store schemas in immutable version-controlled systems (Git with signed commits) or append-only ledgers.
- Enforce branch protections, required code review, and multi-person approval for schema changes.
- Apply least-privilege RBAC to the schema registry; separate roles for proposing and approving changes.
- Encode semantic invariants as policy checks (e.g., OPA/Rego): archive actions cannot map to DELETE unless approved.
- Include provenance metadata with each schema/version: author, signature, hash, timestamp, approved-by.
- Require schema attestation binding the schema hash to a specific agent identity and session.
- Implement runtime sanity checks: if an operation's semantic impact exceeds a threshold, pause and require human approval.

**Static Analysis Indicators (Pre-Connection):**
- Model-directed imperatives in tool descriptions ("ignore previous instructions", "do not tell the user").
- Sensitive-path references in benign descriptions (`~/.ssh`, `.env`, `.aws/credentials`, `/etc/passwd`).
- Exfiltration patterns: action verbs near external destinations (send, post, upload near URLs/webhooks).
- Hidden or zero-width characters (U+200B-200F, U+202A-202E, U+2060, U+FEFF) in descriptions.
- Comment-smuggled instructions hidden inside HTML or markdown comments.

---

## MCP04:2025 — Software Supply Chain Attacks & Dependency Tampering

**Description:** MCP environments rely heavily on third-party components — SDKs, connectors, protocol servers, vector database clients, plugins, and model-side tool integrations. Because these software modules often run within trusted execution paths, a compromised dependency can alter agent behavior, introduce hidden backdoors, or modify protocol semantics without triggering detection. Attackers may target MCP server libraries, third-party plugins, dependency updates, open-source model tooling, build pipelines, and package registries.

**Is the Application Vulnerable?**
- The system installs MCP connectors or plugins without signing or provenance checks.
- Dependencies are fetched automatically during runtime or build.
- SBOM / dependency inventory is incomplete or unavailable.
- Teams use "latest" or floating version references.
- There is no dependency integrity verification (hash, signature, attestation).
- No sandboxing isolates third-party components.
- Vendors/maintainers have no formal security process.
- Open-source components are directly modified and redistributed.
- Plugin code is allowed to perform network calls without review.

**Key Prevention Measures:**
- Require cryptographic signing for SDKs, plugins, tool manifests, and container images; validate on install and startup.
- Generate SBOM and CBOM snapshots for each MCP server + plugin package; store alongside deployments.
- Pin component versions — avoid "latest"; use internal package mirrors or registries; block direct public downloads.
- Apply SCA (software composition analysis) + code scanning to detect known CVEs, malicious indicators, and poisoned transitive dependencies.
- Run plugins in constrained environments (WASM, container isolation) with restricted filesystem and network access.
- Maintain vendor risk profiles; require suppliers to provide signed attestations; review open-source maintainers' security maturity.

**Detection Indicators:**
- Hash/signature changes in installed packages.
- Plugins making calls to unknown domains.
- Silent installation of new dependencies.
- Unauthorized schema or configuration diffs.
- Sudden behavior drift in MCP agents.

---

## MCP05:2025 — Command Injection & Execution

**Description:** Command injection in MCP environments occurs when an AI agent constructs and executes system commands, shell scripts, API calls, or code snippets using untrusted input — whether from user prompts, retrieved context, or third-party data sources — without proper validation or sanitization. Unlike traditional command injection, MCP-based injection is mediated through the model layer: the agent interprets natural language instructions and translates them into executable operations.

**Is the Application Vulnerable?**
- Agents construct shell commands by concatenating user input, prompts, or retrieved data without escaping or parameterization.
- Tool implementations pass agent outputs directly to `exec()`, `system()`, `eval()`, `subprocess.run(shell=True)`, or similar unsafe functions.
- No input validation exists for parameters before they're incorporated into system calls, SQL queries, or API requests.
- Models generate code (bash, Python, PowerShell) that is automatically executed without sandboxing or human review.
- File path operations accept unsanitized input, allowing directory traversal.
- API or database calls are constructed using string interpolation rather than parameterized queries.
- Agent outputs are not constrained to allowlists of permitted commands, arguments, or file paths.
- Special characters (`;`, `|`, `&`, `$()`, backticks, `>`, `<`, `&&`, `||`) in agent-generated parameters are not stripped or escaped.
- Environment variables or secrets can be accessed through command substitution.
- No runtime sandboxing isolates tool execution from the host system.
- Tools run with excessive privileges (root, admin, or broad-permission service accounts).

**Key Prevention Measures:**
- Use allowlists for permitted commands, arguments, and file paths; reject shell metacharacters.
- Normalize and validate all file paths to block traversal.
- Never use `shell=True`, `eval()`, `exec()`, or string-built commands; always execute with structured parameters.
- Disable direct execution of model-generated code unless manually reviewed.
- Run tools inside containers, micro-VMs, gVisor/Kata, or jailed users with timeouts, resource limits, and read-only file systems.
- Isolate high-risk tools (filesystem, network, DB) into separate sandboxes.
- Run tools as non-root with minimal filesystem, API, and DB permissions; prevent agents from accessing env vars or secrets by default.
- Validate agent output against schemas before execution; use parameterized SQL/APIs.
- Reject unsafe patterns: chained commands, redirection, wildcards, command substitution.
- Require human-in-the-loop approval for destructive, privileged, or system-modifying operations.

**Detection Indicators:**
- Shell metacharacters (`;`, `|`, `&`, backticks) in tool parameters or logs.
- Execution of `sudo`, `su`, or SUID binaries by agent processes.
- Outbound connections from agent hosts to unknown domains.
- Access to sensitive paths (`/etc/passwd`, `/root`, `/proc/`, `~/.ssh`).
- Abnormal syscall patterns (e.g., `execve` with suspicious args).
- CPU spikes, memory exhaustion, or disk I/O storms indicating malicious scripts.
- Repeated rejections of inputs containing metacharacters or forbidden commands.

---

## MCP06:2025 — Intent Flow Subversion

**Description:** The **Intent Flow** is the critical path where an agent translates a user's high-level request into a structured sequence of tool calls and actions. Intent Flow Subversion occurs when malicious instructions are embedded within retrieved context — documents from resources, schema definitions, or tool outputs. Unlike direct prompt injection, subversion happens "in-flow": the model retrieves a resource containing hidden instructions that override the original user intent, causing the agent to pivot toward an attacker's objective — often while still appearing to fulfill the original request.

**Is the Application Vulnerable?**
- The system lacks Intent Alignment Validation: it does not verify if the model's next planned tool call is still a logical step toward the original user goal.
- The agent treats text retrieved from MCP `resources/` or `tool outputs` as potential instructions rather than passive data.
- The model generates a new or revised plan after reading external context without a Human-in-the-Loop or Policy-as-Code check.
- System instructions, user intent, and untrusted MCP resources are all merged into a single "flat" prompt window, making them indistinguishable.

**Key Prevention Measures:**
- Explicitly anchor the user's original goal in the system prompt; at every planning step, require a relevance score comparing the next action to that anchor.
- Implement a Policy Decision Point (PDP) that checks proposed tool calls against a whitelist of Goal-Aligned Actions.
- Use a separate, independent "Guardrail Model" to verify proposed tool calls — isolated from potentially poisoned MCP context.
- Treat all natural-language content from MCP `resources/` or `tool outputs` as untrusted; apply OWASP LLM01:2025 safeguards to retrieved context.
- Leverage MCP metadata to tag retrieved content as `[UNTRUSTED_CONTEXT]`; instruct the model to treat tagged content as passive data only.
- Monitor for "Intent Drift" — where semantic alignment between the user's request and the agent's actions degrades; pause and require human re-authentication on deviation.

---

## MCP07:2025 — Insufficient Authentication & Authorization

**Description:** Inadequate authentication and authorization occur when MCP servers, tools, or agents fail to properly verify identities or enforce access controls during interactions. Since MCP ecosystems often involve multiple agents, users, and services exchanging data and executing actions, weak or missing identity validation exposes critical attack paths. Insecure authentication manifests as missing/optional API key validation, hard-coded shared secrets, static credentials, or insecure token issuance. Authorization flaws occur when agents can perform actions beyond their intended privileges, access control relies on client-side enforcement, or tool endpoints don't validate permission scopes.

**Is the Application Vulnerable?**
- MCP servers don't require mutual authentication between agents and tools.
- Tokens or API keys are shared, static, or long-lived.
- Authorization decisions rely on client input or context hints rather than server-side checks.
- Tools or connectors don't validate caller identity or scope before execution.
- There is no RBAC or ABAC model in place.
- Access logs lack identity correlation between agent and user actions.
- Agents can reuse tokens or credentials issued to others.
- No expiration or rotation policies for authentication credentials.

**Key Prevention Measures:**
- Require mutual TLS (mTLS) between MCP clients, agents, and servers.
- Use short-lived, scoped tokens (JWT/OAuth2-style) tied to specific sessions and permissions.
- Enforce token binding to agent identity (e.g., signed agent attestation).
- Validate every token on the server side — never trust client-provided claims.
- Adopt RBAC or ABAC models; evaluate permissions per request, not per session.
- Deny-by-default: any unrecognized agent or scope should be blocked automatically.
- Enforce expiration, rotation, and revocation policies for all tokens; store tokens securely (vaulted or encrypted).
- Detect and block replayed or duplicated tokens.
- Minimize agent permissions — assign only what's needed; split high-privilege operations requiring human review.
- Integrate MCP authentication with organizational IAM or OIDC providers; centralize policy enforcement through a PDP.
- Log every authentication attempt and authorization decision; feed into SIEM/XDR for anomaly detection.
- Disable guest or anonymous access; prevent local testing servers from exposing endpoints publicly.

**Detection Indicators:**
- Tokens reused across multiple agents or IP addresses.
- Failed authentication attempts followed by successful privileged actions.
- Actions performed by unknown or unregistered agent IDs.
- Sudden increase in unauthorized "403" responses in logs.
- Tokens used after expiry timestamps.

---

## MCP08:2025 — Lack of Audit and Telemetry

**Description:** MCP systems often orchestrate complex, autonomous workflows — performing data retrieval, tool execution, and decision-making with minimal human intervention. When audit logging and telemetry are absent or poorly implemented, organizations lose visibility into what actions agents perform, what data they access, and how decisions are made. A lack of comprehensive logging undermines incident response, forensic analysis, and compliance — an unmonitored agent can silently perform sensitive operations or exfiltrate data for weeks without detection.

**Is the Application Vulnerable?**
- Agent activity is not logged in a structured, centralized format (JSON, OpenTelemetry, etc.).
- Logs are stored locally, deleted frequently, or lack integrity protections.
- Tool invocations, prompt contents, and system events are not captured or correlated.
- The environment has no integration with SIEM/XDR or centralized monitoring platforms.
- Logs do not include user identity, timestamps, or schema versioning.
- There is no alerting for anomalous tool use, unauthorized API calls, or unexpected model behaviors.
- Privacy concerns led to overly broad log suppression instead of redaction or anonymization.
- Audit retention policies are undefined or do not align with compliance requirements.

**Key Prevention Measures:**
- Log all agent actions, tool invocations, schema versions, and context snapshots in structured format (JSON, CEF, OTEL).
- Apply cryptographic hashing (HMAC, SHA-256) to log files; store in append-only or WORM storage.
- Include essential fields: timestamp, agent_id, session_id, tool_invoked, parameters_used, response_summary, user_identity.
- Forward MCP logs to enterprise SIEM systems (Splunk, ELK, Sentinel, Chronicle) for correlation.
- Establish automated alert rules for high-risk activities (e.g., tool execution involving sensitive data).
- Use XDR systems to correlate agent behaviors with network or endpoint signals.
- Implement PII-safe logging: tokenize or mask user identifiers; redact sensitive fields before storage.
- Use field-level encryption for secrets, tokens, or confidential context entries.
- Collect telemetry to build behavioral profiles of normal agent operations; use anomaly detection to flag deviations.
- Restrict log access; require dual authorization for log deletion or retention changes.
- Use OpenTelemetry to trace requests across the MCP pipeline — from prompt creation to tool invocation.
- Align log retention with applicable frameworks (e.g., PCI DSS: 1 year minimum); auto-archive or purge per schedule.
- Conduct periodic audit drills to ensure investigators can reconstruct events from logs.

**Detection Indicators:**
- Gaps or inconsistencies in audit trails.
- Unexplained spikes in API billing, latency, or resource consumption.
- Lack of log entries during active usage periods.
- Incident response teams reporting "no data available" during investigations.
- Sudden drop in telemetry ingestion volume.

---

## MCP09:2025 — Shadow MCP Servers

**Description:** "Shadow MCP Servers" refer to unapproved or unsupervised deployments of Model Context Protocol instances that operate outside the organization's formal security governance. Much like Shadow IT, these rogue MCP nodes are often spun up by developers, research teams, or data scientists for experimentation, testing, or convenience — frequently using default credentials, permissive configurations, or unsecured APIs. MCP servers can expose sensitive capabilities — data retrieval, tool execution, model control — making unsanctioned deployments invisible backdoors into enterprise systems that bypass centralized authentication, monitoring, and data governance.

**Is the Application Vulnerable?**
- Teams or developers can deploy MCP servers without central registration or security review.
- There is no asset inventory or endpoint discovery process for internal APIs or services.
- Network monitoring tools show unauthorized services running on unusual ports (e.g., 8000, 8080).
- There is no automated MCP discovery scan across subnets or cloud environments.
- MCP configurations are managed independently by individual teams (no unified baseline templates).
- No governance or change management workflow exists for new AI infrastructure.
- Developers or data scientists use test environments connected to production data sources.

**Key Prevention Measures:**
- Create a centralized MCP registry where every instance must be registered before deployment; tie registration to CI/CD pipelines.
- Maintain metadata: owner, purpose, version, endpoints, compliance state, and contact; require risk classification.
- Use network discovery tools (Nmap, CSPM, EASM) to detect open MCP ports and endpoints; deploy passive network sensors.
- Integrate discovery results with asset inventories and vulnerability management platforms; automate weekly scans.
- Publish secure-by-default MCP configuration templates: enforce mTLS/OAuth, disable unauthenticated tool calls, preconfigure logging and rate-limits.
- Block deployment of MCP instances that deviate from approved templates.
- Require all MCP instances to integrate with central IAM providers (SSO, LDAP, OIDC); use service identities bound to teams.
- Apply network segmentation (VPC-level controls, firewall rules) to limit exposure.
- Correlate telemetry to identify new MCP-related API traffic or agent activity from unknown hosts.
- Set up alerts for endpoints responding on MCP-standard routes (`/mcp`, `/agent/tools`, `/context`).
- Include MCP registration requirements in development onboarding; conduct regular security workshops.
- Integrate MCP governance into corporate IT and AI Acceptable Use Policies; require security sign-off before deployment.

**Detection Indicators:**
- Discovery of unregistered hosts exposing `/mcp` or similar routes.
- Unknown certificates or self-signed certs in network scans.
- Anomalous outbound traffic from R&D subnets.
- Internal threat-hunting tools detecting MCP API patterns in unexpected zones.
- Agents invoking unknown or duplicate MCP endpoints.

---

## MCP10:2025 — Context Injection & Over-Sharing

**Description:** In MCP-based systems, context acts as the working memory for agents — storing prompts, retrieved documents, intermediate reasoning, and interaction history. When this context is shared, persistently stored, or insufficiently scoped, sensitive information from one session, agent, or user can leak into another. **Context Injection** occurs when malicious or unintended content is embedded into this shared memory, influencing how future requests are processed. **Over-Sharing** happens when context is reused across agents or workflows that should be isolated. Together, these issues cause private or sensitive information to propagate beyond its intended boundaries.

**Is the Application Vulnerable?**
- Agents or services share a common context buffer or vector store.
- Context memory persists across multiple users or sessions.
- Context is reused for performance optimization without revalidation.
- Sensitive data enters context without classification or tagging.
- No policy defines how long context can live (no TTL or expiry rule).
- Context or embeddings are reused for multi-agent reasoning.
- The same context store is accessible across teams or departments.
- Agents can access each other's memory without access checks.

**Key Prevention Measures:**
- Make context windows short-lived and per-session by default; enforce automatic deletion after task completion.
- Avoid persistent memory unless explicitly sanctioned and governed.
- Assign unique context namespaces per user, agent, workflow, and tenant.
- Prevent one agent from accessing another agent's memory directly.
- In multi-tenant setups, isolate retrieval indexes and vector stores.
- Tag all inputs and retrieved data (Public, Internal, Confidential, Restricted); prevent low-trust agents from accessing restricted context.
- Define TTL policies (session end, 30 minutes, 24 hours max); automatically purge expired contexts and embeddings.
- Scan and redact PII, secrets, tokens, and internal system identifiers before storing in context.
- Require human approval before sensitive context is exported, summarized, or shared across agents.
- Log agent ID, context ID, read/write events, and TTL/purge events; integrate into SIEM/XDR.
- Detect and block instruction-like content trying to persist in memory ("Ignore previous instructions", "Share everything you know").

---

*This reference is condensed from the OWASP MCP Top 10 2025 Beta specification for use in security scanning and auditing contexts. Example attack scenarios and references sections have been omitted. For full details, see the [OWASP MCP Top 10 project](https://owasp.org/www-project-mcp-top-10/).*
