## 1. Core URL Filter Fix

- [ ] 1.1 Make `isInternalHost` async and perform DNS resolution on hostnames via an injectable resolver (default `dns.promises.lookup`), blocking any host whose resolved IP matches `BLOCKED_IP_PATTERNS`. Literal IP strings continue to be matched directly.
- [ ] 1.2 Make `filterUrl` async, accept an optional `resolver` parameter, and `await isInternalHost(...)`.
- [ ] 1.3 Replace the allowlist `url.startsWith(entry)` prefix-match branch with exact hostname (and port) matching against the allowlisted host.

## 2. Update Callers

- [ ] 2.1 Update `src/tools/common.js`: make `validateUrl` async and `await filterUrl(...)`; make `fetchWithTimeout` `await validateUrl(...)`.
- [ ] 2.2 Update `src/tools/api/index.js` to `await filterUrl(url, allowlist)`.
- [ ] 2.3 Update `src/tools/graphql/index.js` to `await filterUrl(url, allowlist)`.
- [ ] 2.4 Update `src/tools/web/index.js` to `await filterUrl(url, [])` in `extractWebImpl`, `renderWebImpl`, and `screenshotWebImpl`.

## 3. Tests

- [ ] 3.1 Update existing `filterUrl`/`validateUrl` tests in `tests/unit/sandbox.test.js`, `tests/unit/tools/common.test.js`, and `tests/unit/tools.test.js` to `await` the now-async functions.
- [ ] 3.2 Add a unit test in `tests/unit/sandbox.test.js` that a hostname resolving to a private IP is blocked (mock the resolver).
- [ ] 3.3 Add a unit test in `tests/unit/sandbox.test.js` that `https://example.com.evil.com` is rejected when `https://example.com` is allowlisted.
- [ ] 3.4 Add a regression test that allowlist matching is on the exact hostname, not a URL prefix.

## 4. Verification

- [ ] 4.1 Run `npm run lint` and confirm it passes.
- [ ] 4.2 Run `npm run test` and confirm all tests pass.
