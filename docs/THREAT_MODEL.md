# Threat Model

This document is a threat model for `madz` — an analysis of the assets it protects, the trust boundaries it crosses, the attack vectors an adversary could exploit, and the mitigations already in place. It is a living document: update it when subsystems change.

This is **not** the security policy. For vulnerability reporting and supported versions, see [SECURITY.md](../SECURITY.md).

## What This Document Is

This is a **threat model** — an analysis of what madz protects, who might attack it, how they could get in, and what's already in place to stop them. It is a living document: update it when subsystems change.

**Who it's for:** Security reviewers, maintainers, and anyone deploying madz who wants to understand its security posture. It assumes a working knowledge of the architecture (see [OVERVIEW.md](./OVERVIEW.md)) but explains each threat in plain terms.

**How to read it:** The sections build on each other. §1–§4 define the scope, assets, trust boundaries, and actors. §5–§6 enumerate the attack surface and concrete threat scenarios. §7–§8 summarize mitigations and residual risk. If you only have time for two sections, read §6 (threat scenarios) and §8 (residual risk).

---

## 1. Purpose & Scope

`madz` is a local-first AI harness. It runs an LLM agent with tool-calling, a skill system that executes arbitrary scripts, a scheduler that runs jobs on cron, and integrations for email, calendar, search, spreadsheets, and documents. It is typically deployed as a Docker container and accessed via a TUI or SSH.

The threat model covers the runtime components:

- **Agent orchestration** — `src/agent/` (the Deep Agents orchestrator and subagent definitions; the agent loop is compiled by the `deepagents` library, not a hand-written graph)
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

| Asset                          | Description                                         | Sensitivity                     |
| ------------------------------ | --------------------------------------------------- | ------------------------------- |
| **LLM API keys**               | Provider credentials (`OPENAI_API_KEY`, etc.)       | High — grants paid API access   |
| **Email credentials**          | IMAP/SMTP credentials (`EMAIL_IMAP_PASSWORD`, etc.) | High — full mailbox access      |
| **Calendar / search API keys** | Google, MS Graph, Exa, Tavily, etc.                 | Medium-High                     |
| **User conversation data**     | Session history, memory files                       | High — personal/private         |
| **Skill scripts**              | Executable code run by the agent                    | High — arbitrary code execution |
| **Filesystem**                 | Project files, memory, checkpoints, vector DB       | High — read/write/exec          |
| **Scheduled jobs**             | Cron definitions and their inputs                   | Medium — can trigger skills     |
| **Outbound network**           | Tool HTTP calls                                     | Medium — SSRF surface           |
| **Telemetry spans**            | OpenTelemetry traces                                | Medium — may contain PII        |

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

| Actor                     | Trust | Capabilities                                                                                                     |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| **Operator**              | High  | Full control. Not a threat in the normal model, but a misconfiguration source.                                   |
| **Malicious skill**       | Low   | A skill script that tries to escape the sandbox, exfiltrate secrets, or abuse the filesystem/network.            |
| **Prompt-injected agent** | Low   | An LLM that is manipulated via prompt injection to call tools in unintended ways (e.g., read files, send email). |
| **Remote attacker**       | Low   | Exploits exposed services (SSH, HTTP) or SSRF via tool URLs.                                                     |
| **Supply chain**          | Low   | Malicious npm dependencies or skill packages.                                                                    |

---

## 5. Attack Surface / Entry Points

| Entry point       | Component                                    | Notes                                                                                                                                                                      |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill execution   | Deep Agents skill system                     | Skills are `SKILL.md` instruction files interpreted by the LLM; any bundled scripts run through the agent's own `execute`/`process` tools, not a dedicated process sandbox |
| Skill discovery   | `src/skills/discoverer.js`                   | Scans `skills/` and `.skills/`; validates metadata                                                                                                                         |
| Outbound HTTP     | `src/sandbox/urlFilter.js`, `src/tools/api/` | Allows only http/https and enforces the host allowlist; the `api` and `graphql` tools re-validate every redirect hop                                                                |
| Filesystem access | `src/sandbox/pathResolver.js`                | Allowlist/denylist path rules                                                                                                                                              |
| Cron scheduling   | `src/scheduler/cron.js`, `scheduler.js`      | Reads job JSON, builds crontab, executes skills                                                                                                                            |
| Config loading    | `src/config/loader.js`                       | YAML + env var resolution + Zod validation                                                                                                                                 |
| Telemetry         | `src/telemetry/redaction.js`                 | Redacts sensitive span attributes                                                                                                                                          |
| CLI entry         | `index.js`                                   | `--message`, `--session`, chat/interactive modes                                                                                                                           |

---

## 6. Threat Scenarios

### 6.1 Sandbox Escape (Boundary B)

**Threat:** A skill script escapes the sandbox to read/write files outside the allowed scope, access the network, or spawn processes.

**Attack path:** There is no dedicated process sandbox. Skills are `SKILL.md` instruction files interpreted by the LLM; any bundled script is executed through the agent's own `execute`/`process` tools, which run as the application user with the full privileges of the harness process. The constraints that remain are enforced at the tool layer:

- `pathResolver.js` — allowlist/denylist path rules (`resolvePath`), applied by `src/tools/common.js` for tool-side file access.
- `urlFilter.js` — blocked-scheme and host-allowlist filtering for outbound tool requests. It makes no assumptions about network topology: there are no built-in IP or hostname lists.

**Existing mitigations:**

- Path resolution uses `resolve()` and prefix matching with `sep`, blocking traversal outside allowed roots — for tools that call it.
- Negative rules (`!exclude/`) are checked first and override positives.
- URL filtering allows only `http:` and `https:` and, when an allowlist is configured, any host not on it. It does not block internal addresses by itself.
- Skill metadata is validated against `SkillMetadataSchema` (`validator.js`), including a `permissions` declaration.

**Gaps / recommendations:**

- **The `permissions` field is declarative, not enforced.** `SkillMetadataSchema` validates the scopes a skill claims, but nothing gates execution on them — the former `capability.js` / `envInjector.js` / `runner.js` enforcement path was removed as dead code. Treat skill permissions as documentation until an enforcement layer exists.
- The tool-layer path/URL checks are **not** a security boundary in the OS sense. A raw shell command issued through `execute` bypasses `pathResolver` and `urlFilter` entirely. Consider running skills in a container or with OS-level sandboxing (e.g., `bubblewrap`, seccomp) for untrusted skills.
- `trustProjectSkills: true` in config means project skills are trusted by default. Review this default — it assumes the repo's skills are safe.
- There is no timeout or memory cap on skill-bundled scripts; the former `runner.js` limits (`--max-old-space-size`, `handleTimeout` grace period) no longer exist.

### 6.2 Prompt Injection → Tool Abuse

**Threat:** The LLM is manipulated (via a prompt, a web page, an email, or a document) to call tools in unintended ways — e.g., read sensitive files, send email, or delete data.

**Attack path:** The agent processes untrusted content (web search results, emails, documents) and the model decides to invoke a tool. The model is the decision-maker; the sandbox constrains _what_ a tool can do, not _whether_ it should.

**Existing mitigations:**

- Tools have Zod schemas (`src/tools/*/index.js`) validating inputs.
- URL filter allows only `http:`/`https:` and blocks non-allowlisted hosts (when an allowlist is set).
- Sandbox permissions scope what a skill can do.

**Gaps / recommendations:**

- There is no "dangerous action" confirmation gate for tools like email-send or file-delete. Consider an approval/interrupt mechanism for high-impact tools.
- Prompt injection is fundamentally an LLM problem; the harness should treat tool outputs as untrusted input and avoid echoing them back into prompts without sanitization.

### 6.3 SSRF via Tool URLs (Boundary D)

**Threat:** A tool makes an outbound request to an internal service (e.g., cloud metadata endpoint, internal admin panel).

**Attack path:** `filterUrl` is the gate. It allows only `http:` and `https:` and, when an allowlist is set, any host not on it is blocked. It deliberately contains **no** built-in IP-range or hostname lists: reachability is decided by the allowlist, not by assumptions about the network the harness runs in.

**Existing mitigations:**

- Scheme allowlist in `urlFilter.js`: only `http:` and `https:` pass; every other scheme is blocked.
- Allowlist enforcement when `allowlist` is non-empty. Matching is on parsed URL components: an exact host, a `*.example.com` wildcard (at least two labels after `*.`, never matching IP literals), an optional port, or a full origin (with optional path prefix). A bare host entry matches only the scheme's default port (80/443); use `host:port` for others or an `https://host` entry to pin the scheme. It is never a string-prefix match, so `https://allowed.com.evil.com/` does not match `allowed.com`.
- The `api` tool takes its allowlist, rate limit, redirect and retry limits from the server-side `api` config section. The model cannot supply or widen them.
- The `api` and `graphql` tools follow redirects manually (`redirect: "manual"`) and re-run `filterUrl` on every hop, so a redirect cannot reach a blocked scheme or a host outside the allowlist. The `api` tool also drops credentials when a redirect crosses origins.
- The `api` tool never accepts tokens in model input. Credentials are named profiles (`api.credentials`) that read secrets from environment variables at call time and can be restricted to specific hosts.

**Gaps / recommendations:**

- **No internal-address blocking.** With an empty allowlist, a request to `localhost`, an RFC 1918 address or a cloud metadata endpoint (e.g. `169.254.169.254`) is **allowed**. Operators who need that protection must configure an allowlist. Consider making the `api` allowlist required (default-deny).
- **No DNS resolution check.** The filter inspects the URL text only. An allowlisted hostname that later resolves to an internal address, or DNS rebinding, is not detected.
- `browser` uses the same `filterUrl` and checks every request the page makes, including redirects. Redirect re-validation exists in the `api` and `graphql` tools.
- A raw shell command issued through `execute` bypasses `urlFilter` entirely (see §6.1).

### 6.4 Secret Exfiltration

**Threat:** A malicious skill or tool reads env vars / config and exfiltrates credentials.

**Attack path:** There is no env-var filter between the harness process and skill execution. Skills run inside the agent process, which has access to all env vars. The former `envInjector.js` whitelist is gone, so `config.sandbox.env.allowlist` no longer constrains anything.

**Existing mitigations:**

- Secrets are loaded from env vars, not hardcoded.
- Telemetry redaction masks configured paths.

**Gaps / recommendations:**

- Any skill — or prompt-injected tool call — can read the full process environment, including `OPENAI_API_KEY`, `AUTH_API_KEY`, and mail credentials. Review whether these need to live in the same process as skill execution, or whether secrets should be resolved lazily per-tool and never exposed to a general-purpose shell.

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

| Control                                        | Where                                         | Status                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Path allowlist/denylist                        | `pathResolver.js`                             | ✅ Implemented (tool layer only)                                                                                         |
| URL scheme allowlist + host allowlist          | `urlFilter.js`                                | ✅ Implemented (no internal-address blocking; no DNS check)                                                              |
| Redirect re-validation                         | `src/tools/api/`                              | ✅ Implemented for `api` and `graphql`                                                                                   |
| Server-side API policy and credential profiles | `src/config/schemas/api.js`, `src/tools/api/` | ✅ Implemented                                                                                                           |
| Skill metadata validation                      | `validator.js`                                | ✅ Implemented                                                                                                           |
| Telemetry redaction                            | `redaction.js`                                | ✅ Implemented                                                                                                           |
| Zod input validation                           | `src/tools/*/index.js`                        | ✅ Implemented                                                                                                           |
| Auth modes (jwt/apikey/none)                   | AGENTS.md                                     | ⚠️ Verify implementation                                                                                                 |
| Skill permission enforcement                   | —                                             | ❌ Declarative only (`permissions` is validated, never enforced)                                                         |
| Env var whitelist                              | —                                             | ❌ Removed with `envInjector.js`; `sandbox.env.allowlist` has no consumer                                                |
| Timeout + memory limit for skills              | —                                             | ❌ Removed with `runner.js` / `timeoutHandler.js`; `sandbox.timeout` / `sandbox.memoryLimit` have no skill-side consumer |
| Capability → resource mapping                  | —                                             | ❌ Removed with `capability.js`                                                                                          |
| OS-level sandboxing                            | —                                             | ❌ Not present                                                                                                           |

---

## 8. Residual Risk & Recommendations

1. **OS-level sandboxing** — The current sandbox is a constraint layer, not a security boundary. For untrusted skills, run in a container or with seccomp/bubblewrap.
2. **Default-deny outbound allowlist** — Internal addresses are not blocked unless an allowlist is configured. Require an allowlist for the `api` tool, and consider the same for the other network tools. Optionally add DNS resolution to catch allowlisted names that resolve internally.
3. **Redirect re-validation in other tools** — `api` and `graphql` re-validate every redirect hop; any new tool that fetches caller-influenced URLs should apply the same manual-redirect approach.
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
CVE affects a dependency.
