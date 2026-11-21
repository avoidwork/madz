# Design

## Context

`jira` and `confluence` are first-class tools that reuse `makeApiRequest` and take policy from a
server-side config schema. `makeApiRequest` follows redirects internally but only re-validates the
URL filter per hop; it cannot enforce HTTPS-only hops or a final-path rule. See proposal.md.

## Goals / Non-Goals

**Goals:**
- Enforce the Poppy redirect, domain and issuer rules in the tool.
- Mirror the `jira` structure (`src/tools/poppy/index.js`, `PoppySchema`, registration cases).

**Non-Goals:**
- Sessions, sign-in, conversations, and any authenticated Poppy call.
- Caching discovery results.

## Decisions

- **Manual redirect loop.** Call `makeApiRequest` with `maxRedirects: 0` and follow `Location`
  headers inside the tool, checking each hop is HTTPS. The hop limit reuses the existing `api`
  config default (`ApiSchema` `maxRedirects`). Alternative: let `makeApiRequest` follow redirects
  and inspect the final `url`; rejected because an intermediate HTTP hop would go unnoticed.
- **Permissive nested schema.** The Zod schema requires `protocol_version` and `organization`
  (`domain`); `auth`, `agent`, `apis`, `web`, `tasks`, `extensions` are optional and use
  `.passthrough()` so unknown fields from newer protocol versions do not break discovery.
- **Issuer check is skipped on 404.** Protected resource metadata is optional ("when present").
  Any other failure is an error.
- **Domain input** is validated as a bare hostname (no scheme, path, port, or userinfo) so the model
  cannot steer the request elsewhere.

## Risks / Trade-offs

- [Document fields beyond those named in the issue are unspecified] -> passthrough objects; the
  summary reads only well-known keys defensively.
