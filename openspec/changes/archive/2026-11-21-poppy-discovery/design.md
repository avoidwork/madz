# Design

## Context

See proposal.md - Why. madz needs a `poppy` tool that fetches and validates a company's `poppy.json` at `/.well-known/poppy.json` per the Poppy protocol (personalagentprotocol.org, section 3 Discovery). This is the foundational first step in the progressive-enhancement series; later layers (sessions, OAuth, APIs, conversations) build on the normalized output.

## Goals / Non-Goals

**Goals:**
- Add a `poppy` tool under `src/tools/poppy/` that fetches and validates `poppy.json`.
- Enforce HTTPS-only and the protocol's redirect rules.
- Validate required fields and domain matching.
- Return a normalized representation and cache per-domain with TTL.
- Register the tool and add unit + integration tests.

**Non-Goals:**
- No OAuth, session, API, or conversation layers (later steps).
- No credential storage.
- No new runtime dependency (Node's built-in `fetch`/undici is used).

## Decisions

### Decision 1: Split fetch/validation into `discovery.js`, registration in `index.js`
The tool module is split into `src/tools/poppy/index.js` (LangChain `tool()` registration, Zod input schema) and `src/tools/poppy/discovery.js` (fetch, validation, normalization, caching). This mirrors the project's separation of tool registration from logic and keeps the discovery logic unit-testable without instantiating a LangChain tool. **Alternative considered:** single file — rejected because the discovery logic is substantial and benefits from isolated unit testing.

### Decision 2: Use Node's built-in `fetch` (undici v6+)
No new runtime dependency. `fetch` supports redirects and is the active, maintained choice. **Alternative considered:** third-party Poppy SDK — rejected because the protocol is new and the project prefers local, dependency-light implementations.

### Decision 3: Strict redirect rules
The initial request and every redirect MUST be HTTPS; the final URL's path MUST be exactly `/.well-known/poppy.json` with no query; the serving host (after redirects) MUST match `organization.domain` case-insensitively. This prevents a document from another host speaking for a company (OWASP). **Alternative considered:** trusting the first host — rejected because it allows cross-host spoofing.

### Decision 4: Zod schema for validation
All document fields are validated against a Zod schema before use, per project convention. Required fields: `protocol_version`, `organization.name`, `organization.domain`, and at least one of `agent`/`apis`/`web`. All URLs validated HTTPS and non-private.

### Decision 5: Per-domain LRU cache with TTL
Use the project's existing `tiny-lru` dependency for a per-domain LRU cache with a configurable TTL (sensible default). Cache key is the domain. **Alternative considered:** no cache — rejected because discovery is called per interaction and repeated fetches are wasteful.

### Decision 6: `supported_versions` selection
When the document lists `supported_versions`, select the newest compatible version. If absent or empty, use the document as-is.

## Risks / Trade-offs

- **[Cross-host spoofing]** A redirect to another host could serve a document for a company → Mitigation: enforce the redirect rules and domain-match check.
- **[Cache staleness]** A cached document could go stale → Mitigation: TTL-based expiry; failed fetches do not poison the cache.
- **[Address validation]** Loopback/private/link-local addresses are rejected by default → Mitigation: allow configuration to permit them when needed.
- **[Coverage]** New code needs test coverage → Mitigation: unit tests for parsing, validation, redirects, version selection; integration test against a local HTTPS server.

## Migration Plan

No migration needed — this is a new tool. Rollback is removing the tool registration and module.

## Open Questions

None.
