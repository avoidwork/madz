# Proposal

## Why

Every interaction with a company under the Poppy (Personal Agent Protocol) protocol begins with discovery: the agent fetches the company's `poppy.json` at `/.well-known/poppy.json` to learn its APIs, company agent, website, scopes, and sign-in options. Without this foundation, none of the later protocol layers (sessions, OAuth, APIs, conversations) can be implemented. This is the first, foundational step in the progressive-enhancement series.

## What Changes

- Add a new `poppy` tool at `src/tools/poppy/` that fetches `https://{domain}/.well-known/poppy.json` over HTTPS, following redirects (each redirect MUST be HTTPS, and the final URL's path MUST be exactly `/.well-known/poppy.json` with no query).
- Validate the document against the protocol's required fields: `protocol_version`, `organization` (name, domain), and at least one of `agent`, `apis`, or `web`.
- Check `organization.domain` equals the host that served the document (after redirects), case-insensitive.
- Validate all URLs are HTTPS and not loopback/private/link-local addresses (unless configured).
- Return a normalized, typed representation of the document for downstream layers.
- Cache the document per-domain with a TTL, and support `supported_versions` selection (choose the newest compatible version).
- Register `poppy` in `src/tools/index.js` (`TOOL_PERMISSIONS`, `TOOL_CLASSIFICATIONS`, `ORCHESTRATOR_TOOLS`, `TOOLS`).
- Add unit tests under `tests/unit/tools/poppy/` and an integration test under `tests/integration/tools/poppy/`.

## Capabilities

### New Capabilities
- `poppy-discovery`: a `poppy` tool that fetches and validates a company's `poppy.json` document per the Poppy protocol, returning a normalized representation and caching per-domain.

### Modified Capabilities
<!-- No existing spec-level behavior changes. -->

## Impact

- `src/tools/poppy/index.js` — new tool registration and schema.
- `src/tools/poppy/discovery.js` — fetch, validation, normalization, caching.
- `src/tools/index.js` — registration points.
- `tests/unit/tools/poppy/discovery.test.js` — unit tests.
- `tests/integration/tools/poppy/discovery.test.js` — integration test.

## Non-goals

- No changes to other tools.
- No credential storage or OAuth/session/API layers (later steps in the series).
- No new runtime dependency (Node's built-in `fetch`/undici is used).
