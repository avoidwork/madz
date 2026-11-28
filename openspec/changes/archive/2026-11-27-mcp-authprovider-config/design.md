# Design

## Context

See proposal.md - Why. The MCP server config schema types `authProvider` as `z.unknown().optional()` on the `http`/`sse` transport variants, which prevents `buildReverseMap`/`syncEnv` in `src/config/loader.js` from recursing into it. madz also ships no built-in `OAuthClientProvider`, so OAuth2-protected remote MCP servers cannot be configured via env vars or a built-in provider.

## Goals / Non-Goals

**Goals:**
- Type the `authProvider` schema so `buildReverseMap`/`syncEnv` can materialize `MCP_<SERVER>_AUTHPROVIDER_*` env vars.
- Ship a built-in `OAuthClientProvider` backed by `@langchain/auth` (v0.1.0).
- Wire the resolved `authProvider` through to `MCPAdapter` unchanged.

**Non-Goals:**
- No change to the `stdio` transport's accepted fields.
- No change to the static `headers` bearer-token pattern in `src/tools/poppy/api.js`.

## Decisions

### Decision 1: Type `authProvider` as a Zod object schema
Replace `authProvider: z.unknown().optional()` with a typed object schema representing an OAuth client provider config. `buildReverseMap`'s `object` branch recurses into nested objects, so the sub-fields become materializable from env vars. The schema includes `clientId`, `clientSecret`, `authorizationServer`, `scopes` (array of strings), `tokenEndpoint`, `provider`, `userId`, `apiKey`, `apiUrl`, `usesPkce`, and `codeChallengeMethod`.

**Alternatives considered:**
- Keep `z.unknown()` — rejected because `buildReverseMap` has no `"unknown"` case, so env vars never materialize.
- A `z.record()` — rejected because the provider config has a fixed set of known fields, not arbitrary keys.

### Decision 2: Use `@langchain/auth` as the OAuth library
Install `@langchain/auth@^0.1.0` and build the built-in provider by wrapping its `Client` (via `authenticate()` / `waitForCompletion()`) to implement the MCP `OAuthClientProvider` interface. This avoids hand-rolling a bespoke OAuth implementation.

**Alternatives considered:**
- Hand-rolled OAuth provider — rejected per the implementation directive; use the maintained SDK.
- `@langchain/oauth` — does not exist as a published package; `@langchain/auth` is the maintained LangChain OAuth auth SDK.

### Decision 3: Built-in provider implements the MCP `OAuthClientProvider` interface
The provider class implements the `OAuthClientProvider` interface re-exported by `@langchain/mcp-adapters` (from `@modelcontextprotocol/sdk`). It is constructed from the typed `authProvider` config object and passed through to `MCPAdapter` unchanged.

### Decision 4: Keep `agents` stripping intact
In `src/tools/index.js`, only madz-specific fields (`agents`) are stripped before constructing the adapter; `authProvider` flows through unchanged.

## Risks / Trade-offs

- [The `@langchain/auth` `Client` requires an API key (`LANGSMITH_API_KEY` or `apiKey` option)] → The provider config exposes `apiKey`/`apiUrl`; document that a key is required for the hosted auth flow.
- [Token refresh must be handled] → The provider delegates token acquisition to `@langchain/auth`'s `Client`, which handles the auth flow and token retrieval.
- [The adapter's config schema is strict] → Only `agents` is stripped; `authProvider` flows through unchanged.

## Migration Plan

No breaking change. Existing configs that omit `authProvider` continue to work. Configs that previously set `authProvider` as an opaque object now validate against the typed schema.

## Open Questions

None.
