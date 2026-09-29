## Context

`src/sandbox/urlFilter.js` validates outbound URLs for the tool layer. It blocks prohibited schemes (`file://`, `gopher://`, `dict://`), blocks internal/private IPs, and enforces an allowlist. Two security gaps exist:

1. **SSRF via hostname resolution**: `isInternalHost` only matches literal IP strings against `BLOCKED_IP_PATTERNS` and checks `localhost`/`0.0.0.0`. It never performs a DNS lookup, so a domain resolving to a private address (e.g., a domain pointing at `169.254.169.254`) passes validation. This is an OWASP SSRF vector.
2. **Allowlist prefix-match bypass**: The allowlist check uses `url.startsWith(entry)`, so `https://example.com.evil.com` passes when `https://example.com` is allowlisted.

The fix requires DNS resolution, which is inherently async. This makes `filterUrl` async, a breaking API change that ripples to all callers.

## Goals / Non-Goals

**Goals:**
- Block hostnames that resolve to internal/private IPs, not just literal IP strings.
- Match allowlist entries on the exact hostname (and port), rejecting prefix-match bypasses like `example.com.evil.com`.
- Keep the internal-host check always-enforced (unless test mode), regardless of allowlist.
- Make the DNS resolver injectable so unit tests can mock it.
- Update all callers and tests to the async `filterUrl` API.

**Non-Goals:**
- No change to path resolution (`pathResolver.js`).
- No change to the blocked scheme set.
- No change to test-mode behavior (`setTestMode`).
- No change to the `isSchemeAllowed` function (it does not perform hostname resolution).

## Decisions

### Decision 1: Make `filterUrl` async and perform DNS resolution in `isInternalHost`

`isInternalHost` becomes `async` and, for hostnames that are not literal IPs, performs a DNS lookup via `dns.promises.lookup`. If any resolved IP matches `BLOCKED_IP_PATTERNS`, the host is blocked. Literal IP strings continue to be matched directly against the patterns (no DNS lookup needed).

**Alternatives considered:**
- *Synchronous DNS via `dns.lookupSync`*: Rejected — blocking I/O in async contexts is forbidden by project rules (§1.1).
- *Keep `filterUrl` sync and resolve elsewhere*: Rejected — the resolution must happen at validation time to be effective.

### Decision 2: Injectable resolver

`filterUrl` accepts an optional third parameter `resolver` (defaulting to `dns.promises.lookup`). This enables unit tests to mock the resolver per the issue's testing strategy ("mock the resolver"). The resolver signature matches `dns.promises.lookup(hostname, options)` → `Promise<{ address, family }>`.

### Decision 3: Fail-open on DNS resolution failure

If DNS resolution throws (e.g., `ENOTFOUND`), the host is treated as not-internal (fail-open). Rationale: a hostname that cannot be resolved cannot be fetched, so it is not an SSRF vector. This preserves existing test behavior that uses non-resolving test domains (e.g., `api.example.com`) while still blocking hostnames that resolve to internal IPs.

### Decision 4: Exact-hostname allowlist matching

Remove the `url.startsWith(entry)` branch. Parse each allowlist entry to extract its hostname and port (handling bare hostnames, `hostname:port`, and full URLs like `https://example.com`). Compare `parsed.hostname` (and `parsed.port`) against the allowlisted hostname (and port). Subdomains are not implicitly allowed — only exact hostname (and port) matches pass.

**Alternatives considered:**
- *Suffix match on `.example.com`*: Rejected — would implicitly allow all subdomains, which is broader than the issue's intent and could introduce new bypasses.
- *Keep `startsWith` but require boundary*: Rejected — fragile and error-prone; exact hostname comparison is unambiguous.

## Risks / Trade-offs

- **[Breaking API change]** `filterUrl` becomes async → All callers and tests must be updated. Mitigation: update all callers (`api`, `graphql`, `web`, `common`) and tests in the same change; the pipeline verifies tests and lint.
- **[DNS resolution latency]** Every outbound URL validation now performs a DNS lookup → Adds latency to tool calls. Mitigation: resolution only occurs for hostnames (not literal IPs); the resolver is the standard `dns.promises.lookup`.
- **[Fail-open on DNS failure]** A hostname that fails to resolve is allowed → Could a malicious hostname cause resolution to fail and bypass? No — if it cannot resolve, it cannot be fetched. This is not an SSRF vector.
- **[Allowlist exact-match strictness]** Existing configs that relied on prefix matching (e.g., allowlisting `https://example.com` to permit `https://example.com/path`) still work because the hostname matches; only cross-host prefix bypasses are rejected.
