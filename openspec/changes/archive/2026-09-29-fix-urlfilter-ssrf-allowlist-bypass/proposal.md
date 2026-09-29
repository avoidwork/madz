## Why

`src/sandbox/urlFilter.js` has two security gaps in outbound URL validation that enable SSRF (OWASP SSRF) and allowlist prefix-match bypass. `isInternalHost` claims to resolve hostnames to detect internal IPs but never performs a DNS lookup, so a domain resolving to a private address (e.g., `169.254.169.254`) passes validation. The allowlist check uses `url.startsWith(entry)`, permitting `https://example.com.evil.com` to pass when `https://example.com` is allowlisted.

## What Changes

- **BREAKING**: `filterUrl` becomes `async` so it can perform DNS resolution on hostnames. All callers must `await filterUrl(...)`.
- `isInternalHost` becomes `async` and performs a DNS lookup on hostnames, blocking any host whose resolved IP matches the existing `BLOCKED_IP_PATTERNS` (RFC 1918, loopback, link-local, metadata, IPv6 unique-local/link-local). Literal IP strings continue to be matched directly.
- The DNS resolver is injectable (defaults to `dns.promises.lookup`) so it can be mocked in unit tests.
- The allowlist check removes the `url.startsWith(entry)` prefix-match branch and instead matches on the exact hostname (and port), so `example.com.evil.com` is rejected when `example.com` is allowlisted.
- `validateUrl` in `src/tools/common.js` becomes `async` and `await filterUrl(...)`; `fetchWithTimeout` awaits `validateUrl(...)`.
- Callers in `src/tools/api/index.js`, `src/tools/graphql/index.js`, and `src/tools/web/index.js` are updated to `await filterUrl(...)`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `sandbox-rte`: The Network Access Control requirement is strengthened. Hostnames that resolve to internal/private IPs SHALL be blocked (not just literal IP strings), and allowlist matching SHALL match on the exact hostname (and port) rather than a URL prefix.

## Impact

- `src/sandbox/urlFilter.js` — core fix (async `isInternalHost` with DNS resolution; exact-hostname allowlist matching).
- `src/tools/api/index.js`, `src/tools/graphql/index.js`, `src/tools/web/index.js`, `src/tools/common.js` — callers updated to `await filterUrl(...)` / `await validateUrl(...)`.
- `tests/unit/sandbox.test.js`, `tests/unit/tools/common.test.js`, `tests/unit/tools.test.js` — existing tests updated to `await`; new tests added for SSRF blocking (mocked resolver) and allowlist exact-hostname matching.
- **Non-goals**: No change to path resolution (`pathResolver.js`), no change to blocked schemes, no change to the test-mode behavior.

## Non-goals

- No changes to `src/sandbox/pathResolver.js`.
- No changes to the blocked scheme set (`file://`, `gopher://`, `dict://`).
- No changes to test-mode behavior (`setTestMode`).
