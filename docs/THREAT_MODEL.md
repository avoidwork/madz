# Threat Model

This document is a threat model for `madz` — an analysis of the assets it protects, the trust boundaries it crosses, the attack vectors an adversary could exploit, and the mitigations already in place. It is a living document: update it when subsystems change.

This is **not** the security policy. For vulnerability reporting and supported versions, see [SECURITY.md](../SECURITY.md).

---

## 1. Purpose & Scope

`madz` is a local-first AI harness. It runs an LLM agent with tool-calling, a skill system that executes arbitrary scripts, a scheduler that runs jobs on cron, and integrations for email, calendar, search, spreadsheets, and documents. It is typically deployed as a Docker container and accessed via a TUI or SSH.

The threat model covers the runtime components:

- **Agent orchestration** — `src/agent/`, `src/graphs/`
- **Skills system** — `src/skills/` (discovery, validation, permissions, registry)
- **Sandbox** — `src/sandbox/` (runner, path resolver, URL filter, env injector, capability)
- **Scheduler** — `src/scheduler/` (cron sync, job execution)
- **Tools** — `src/tools/` (email, calendar, search, spreadsheet, pptx, web, etc.)
- **Config & secrets** — `config.yaml`, `src/config/`
- **Telemetry** — `src/telemetry/` (redaction)
- **Persistence** — memory, checkpoints, vector search (SQLite)

**Out of scope:** the security of the LLM provider's own infrastructure, the host OS hardening, and the security of third-party APIs madz integrates with.

---

## 2. Assets

| Asset | Description | Sensitivity |
|---|---|---|
| **LLM API keys** | Provider credentials (`OPENAI_API_KEY`, etc.) | High — grants paid API access |
| **Email credentials** | IMAP/SMTP credentials (`EMAIL_IMAP_PASSWORD`, etc.) | High — full mailbox access |
| **Calendar / search API keys** | Google, MS Graph, Exa, Tavily, etc. | Medium-High |
| **User conversation data** | Session history, memory files | High — personal/private |
| **Skill scripts** | Executable code run by the agent | High — arbitrary code execution |
| **Filesystem** | Project files, memory, checkpoints, vector DB | High — read/write/exec |
| **Scheduled jobs** | Cron definitions and their inputs | Medium — can trigger skills |
| **Outbound network** | Tool HTTP calls | Medium — SSRF surface |
| **Telemetry spans** | OpenTelemetry traces | Medium — may contain PII |

---

## 3. Trust Boundaries

```
┌───────────────────────────────────────────────────────────────┐
│  TRUSTED: Operator / Local User                               │
│  - Runs the TUI, invokes skills, edits config.yaml            │
│  - Has full filesystem + env access                           │
└──────────────────────────┬────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  madz core (Node.js)    │  ← boundary A
              │  agent, tools, scheduler│
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
│ Sandboxed      │ │ LLM provider   │ │ External APIs  │
│ skill scripts  │ │ (OpenAI, etc.) │ │ (email, search)│
│ (boundary B)   │ │ (boundary C)   │ │ (boundary D)   │
└────────────────┘ └────────────────┘ └────────────────┘
```

- **Boundary A — Operator to core.** The operator is trusted. They can edit config, add skills, and run commands. The core trusts the operator.
- **Boundary B — Core to sandboxed skills.** Skills are untrusted code. The sandbox constrains filesystem, network, env, and process access. This is the primary boundary.
- **Boundary C — Core to LLM provider.** The agent sends prompts to a remote LLM. The provider is a third party; prompt content and tool outputs cross this boundary.
- **Boundary D — Core to external APIs.** Tools make outbound HTTP calls. The URL filter constrains these.

---

## 4. Threat Actors

| Actor | Trust | Capabilities |
|---|---|---|
| **Operator** | High | Full control. Not a threat in the normal model, but a misconfiguration source. |
| **Malicious skill** | Low | A skill script that tries to escape the sandbox, exfiltrate secrets, or abuse the filesystem/network. |
| **Prompt-injected agent** | Low | An LLM that is manipulated via prompt injection to call tools in unintended ways (e.g., read files, send email). |
| **Remote attacker** | Low | Exploits exposed services (SSH, HTTP) or SSRF via tool URLs. |
| **Supply chain** | Low | Malicious npm dependencies or skill packages. |

---

## 5. Attack Surface / Entry Points

| Entry point | Component | Notes |
|---|---|---|
| Skill execution | `src/sandbox/runner.js` | Spawns scripts with an interpreter; resource limits + timeout |
| Skill discovery | `src/skills/discoverer.js` | Scans `skills/` and `.skills/`; validates metadata |
| Outbound HTTP | `src/sandbox/urlFilter.js` | Filters schemes, internal IPs, allowlist |
| Filesystem access | `src/sandbox/pathResolver.js` | Allowlist/denylist path rules |
| Env injection | `src/sandbox/envInjector.js` | Whitelist of env vars passed to child |
| Cron scheduling | `src/scheduler/cron.js`, `scheduler.js` | Reads job JSON, builds crontab, executes skills |
| Config loading | `src/config/loader.js` | YAML + env var resolution + Zod validation |
| Telemetry | `src/telemetry/redaction.js` | Redacts sensitive span attributes |
| CLI entry | `index.js` | `--message`, `--session`, chat/interactive modes |

---

## 6. Threat Scenarios

### 6.1 Sandbox Escape (Boundary B)

**Threat:** A skill script escapes the sandbox to read/write files outside the allowed scope, access the network, or spawn processes.

**Attack path:** A skill with `filesystem:exec` or `process:spawn` permission runs arbitrary code. The sandbox relies on:
- `pathResolver.js` — allowlist/denylist path rules (`resolvePath`).
- `envInjector.js` — only whitelisted env vars passed to the child.
- `runner.js` — timeout + memory limit (`--max-old-space-size=512` for Node).

**Existing mitigations:**
- Path resolution uses `resolve()` and prefix matching with `sep`, blocking traversal outside allowed roots.
- Negative rules (`!exclude/`) are checked first and override positives.
- Env is filtered to a whitelist (`config.sandbox.env.allowlist`).
- Timeout via `handleTimeout` with a grace period.

**Gaps / recommendations:**
- The sandbox is **not** a security boundary in the OS sense — it is a best-effort constraint layer. A malicious skill with `process:spawn` can run any binary. Consider running skills in a container or with OS-level sandboxing (e.g., `bubblewrap`, seccomp) for untrusted skills.
- `trustProjectSkills: true` in config means project skills are trusted by default. Review this default — it assumes the repo's skills are safe.
- Memory limit is only applied to Node scripts (`--max-old-space-size`); Python/Ruby/other interpreters have no memory cap. Consider a cgroup or `ulimit` for all interpreters.
- `detectShebang` falls back to `node` if no interpreter is detected — a script with no shebang and an unexpected extension still runs as Node.

### 6.2 Prompt Injection → Tool Abuse

**Threat:** The LLM is manipulated (via a prompt, a web page, an email, or a document) to call tools in unintended ways — e.g., read sensitive files, send email, or delete data.

**Attack path:** The agent processes untrusted content (web search results, emails, documents) and the model decides to invoke a tool. The model is the decision-maker; the sandbox constrains *what* a tool can do, not *whether* it should.

**Existing mitigations:**
- Tools have Zod schemas (`src/tools/*/index.js`) validating inputs.
- URL filter blocks internal IPs and non-allowlisted hosts.
- Sandbox permissions scope what a skill can do.

**Gaps / recommendations:**
- There is no "dangerous action" confirmation gate for tools like email-send or file-delete. Consider an approval/interrupt mechanism for high-impact tools.
- Prompt injection is fundamentally an LLM problem; the harness should treat tool outputs as untrusted input and avoid echoing them back into prompts without sanitization.

### 6.3 SSRF via Tool URLs (Boundary D)

**Threat:** A tool makes an outbound request to an internal service (e.g., cloud metadata endpoint, internal admin panel).

**Attack path:** `filterUrl` is the gate. It blocks `file:`, `gopher:`, `dict:` schemes and internal IP ranges (RFC 1918, loopback, link-local, IPv6 ULA).

**Existing mitigations:**
- `BLOCKED_SCHEMES` and `BLOCKED_IP_PATTERNS` in `urlFilter.js`.
- Allowlist enforcement when `allowlist` is non-empty.
- `isInternalHost` resolves `localhost` and `0.0.0.0`.

**Gaps / recommendations:**
- `isInternalHost` only checks literal IP patterns and `localhost`/`0.0.0.0`. It does **not** resolve DNS to detect a hostname that resolves to an internal IP (e.g., `http://internal-service/`). A DNS rebinding or a hostname pointing to a private IP could bypass the check. Consider resolving the hostname and validating the resolved IP.
- The allowlist matching uses `url.startsWith(entry)` — a prefix match that could be bypassed with a crafted URL (e.g., `https://allowed.com.evil.com/`). Use exact hostname matching instead.
- `_testMode` disables internal-IP blocking entirely. Ensure it is never enabled in production.

### 6.4 Secret Exfiltration

**Threat:** A malicious skill or tool reads env vars / config and exfiltrates credentials.

**Attack path:** `envInjector.js` only passes whitelisted env vars to child processes. But the core process itself has access to all env vars.

**Existing mitigations:**
- `config.sandbox.env.allowlist` limits what a skill sees.
- Secrets are loaded from env vars, not hardcoded.
- Telemetry redaction masks configured paths.

**Gaps / recommendations:**
- The allowlist includes `AUTH_API_KEY`, `EMAIL_IMAP_PASSWORD`, etc. — these are passed to skills. A malicious skill with `env:read` permission could read them. Review whether skills need these or whether they should be scoped per-skill.
- `OPENAI_API_KEY` is in the allowlist. Consider whether skills need the LLM key.

### 6.5 Cron Job Abuse

**Threat:** A scheduled job executes a skill with unintended input, or a job definition is tampered with.

**Attack path:** `src/scheduler/` reads job JSON from disk, builds crontab entries, and executes skills via the sandbox. The derived command for skill-only jobs serializes `input` into the `--message` argument.

**Existing mitigations:**
- Jobs are validated (`name`, `cron`, `skill`/`command`).
- Skill execution goes through the sandbox with permissions.
- `enabled: false` jobs are skipped.

**Gaps / recommendations:**
- Job JSON files are read from the schedules directory with no integrity check. If an attacker can write to that directory, they can inject a job. Ensure the schedules directory is not writable by untrusted processes.
- The `--message` argument is a shell string built from skill name + serialized input. If input contains shell metacharacters, it could break out of the quoted string. **Verify input is properly escaped/quoted** when building the command.

### 6.6 Config / Secret Handling

**Threat:** Secrets leak via config, logs, or telemetry.

**Attack path:** `config.yaml` uses `${VAR_NAME}` interpolation or direct env vars. The loader resolves and validates via Zod.

**Existing mitigations:**
- Secrets only from env vars.
- Telemetry redaction (`redaction.js`) masks configured paths.
- Zod validation rejects malformed config.

**Gaps / recommendations:**
- `config.yaml` has empty-string placeholders for many API keys (`apiKey: ""`). Ensure these are never committed with real values.
- Redaction is path-based; verify it covers all sensitive config paths (credentials, apiKey, clientSecret, etc.).

### 6.7 Supply Chain

**Threat:** A malicious npm dependency or skill package.

**Attack path:** `npm ci` installs dependencies; skills are discovered from `skills/` and `.skills/`.

**Existing mitigations:**
- Skill metadata validation (`validator.js`) checks name/description.
- `npm audit` flags known vulnerabilities.

**Gaps / recommendations:**
- The dependency tree has 14 known vulnerabilities (see issue #1059). Track and remediate.
- Skill validation checks metadata format, not code behavior. A skill's scripts are trusted at execution time.

---

## 7. Mitigation Summary

| Control | Where | Status |
|---|---|---|
| Path allowlist/denylist | `pathResolver.js` | ✅ Implemented |
| URL scheme + internal IP filter | `urlFilter.js` | ✅ Implemented (DNS gap) |
| Env var whitelist | `envInjector.js` | ✅ Implemented |
| Timeout + memory limit | `runner.js` | ⚠️ Memory only for Node |
| Capability → resource mapping | `capability.js` | ✅ Implemented |
| Skill metadata validation | `validator.js` | ✅ Implemented |
| Telemetry redaction | `redaction.js` | ✅ Implemented |
| Zod input validation | `src/tools/*/index.js` | ✅ Implemented |
| Auth modes (jwt/apikey/none) | AGENTS.md | ⚠️ Verify implementation |
| OS-level sandboxing | — | ❌ Not present |

---

## 8. Residual Risk & Recommendations

1. **OS-level sandboxing** — The current sandbox is a constraint layer, not a security boundary. For untrusted skills, run in a container or with seccomp/bubblewrap.
2. **DNS resolution in URL filter** — Resolve hostnames and validate the resolved IP to prevent SSRF via DNS rebinding or internal hostnames.
3. **Exact allowlist matching** — Replace `url.startsWith(entry)` with exact hostname matching to prevent prefix-bypass.
4. **Shell injection in cron command** — Verify the `--message` argument is properly escaped when building the derived command from skill + input.
5. **Dangerous-action approval** — Add a confirmation gate for high-impact tools (email send, file delete).
6. **Dependency remediation** — Track and remediate the 14 npm vulnerabilities (issue #1059).
7. **Schedules directory integrity** — Ensure the schedules directory is not writable by untrusted processes.
8. **Review `trustProjectSkills`** — Consider defaulting to `false` for untrusted repos.

---

## 9. Review Cadence

This threat model should be reviewed when:
- A new tool or skill type is added.
- The sandbox or scheduler changes.
- A new external integration (email, calendar, search) is added.
- A security issue is reported or a CVE affects a dependency.
