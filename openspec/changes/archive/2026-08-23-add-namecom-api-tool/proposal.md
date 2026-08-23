## Why

Users need to manage domains, DNS records, transfers, and related services through name.com's API. Currently there is no tool for this in the harness. A single unified tool with an `action` parameter keeps the tool surface clean while providing full API coverage.

## What Changes

- Add a new `namecom` tool wrapping 72 name.com Core API operations across 17 tag groups
- Authentication via `NAMECOM_USERNAME` and `NAMECOM_TOKEN` environment variables (Basic Auth)
- Action-based dispatch pattern matching existing `email` and `process` tools
- HTTP client with URL allowlist validation, rate limit handling, and consistent error responses
- Register tool in `src/tools/index.js` with `network:outbound` permission

## Capabilities

### New Capabilities

- `namecom-api`: Full name.com Core API integration — domain management, DNS records, transfers, email/URL forwarding, vanity nameservers, DNSSEC, webhook notifications, orders, refunds, TLD pricing, premium domains, contact verification, and account info

### Modified Capabilities

- None

## Impact

- **Affected code**: `src/tools/index.js` (tool registration), new file `src/tools/namecom/index.js`
- **New dependencies**: None — uses native `fetch()` and existing Zod
- **Tests**: New file `tests/unit/tools/namecom.test.js`
- **Config**: No config.yaml changes — credentials from env vars only

## Non-goals

- OAuth authentication flows
- Reseller account management beyond what the API provides
- Domain parking or transfer-out flows not covered by the API spec
- Caching layer for API responses