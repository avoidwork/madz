## Context

Madz currently has no email integration. The tool system (`src/tools/index.js`) uses a tiered permission model with factory-pattern tool registration. Configuration is loaded from `config.yaml` via Zod schemas. External dependencies follow the existing pattern of installing npm packages and wiring them into the tool factory.

## Goals / Non-Goals

**Goals:**
- Implement provider-abstracted email tools (read, send, draft, organize)
- Support Gmail, MS Graph, and IMAP providers
- Register tools in the tier2 tool map with `network:outbound` permission
- Add provider configuration schemas validated at startup
- Store OAuth tokens securely in the memory system

**Non-Goals:**
- Push/webhook email notifications (pull-only v1)
- Multi-account support (single provider per session)
- Calendar integration (separate issue #780)
- Email encryption/signing (PGP/S/MIME)
- Mobile push notifications

## Decisions

**Decision 1: Provider abstraction via adapter pattern**
- Use a common `EmailProvider` interface with methods: `send()`, `read()`, `search()`, `draft()`, `organize()`
- Each provider (Gmail, Graph, IMAP) implements this interface
- Rationale: Allows adding new providers without modifying existing tool code; mirrors patterns already used in the codebase

**Decision 2: IMAP as universal fallback**
- When no OAuth provider is configured, IMAP provides access to any email service
- IMAP uses username/password stored in encrypted form
- Rationale: Universal compatibility without requiring OAuth setup; Gmail and Graph offer richer features but require OAuth

**Decision 3: Single provider per session**
- Configuration supports one active provider at a time
- Simplifies authentication state management and token lifecycle
- Rationale: Multi-account support adds significant complexity; single provider covers 95% of use cases

**Decision 4: OAuth2 tokens stored in memory system**
- OAuth tokens persisted via the existing memory writer/reader system
- Tokens encrypted at rest, decrypted on use
- Rationale: Reuses existing secure storage pattern; avoids creating a new credentials module

**Decision 5: Attachments reuse web.js validation**
- Attachment MIME validation and path resolution reuse patterns from `src/tools/web.js`
- Rationale: DRY principle; attachment handling is identical regardless of email provider

**Decision 6: Dependencies — googleapis + nodemailer**
- Gmail: `googleapis` (official Google API client)
- MS Graph: `@microsoft/microsoft-graph-client` (official Microsoft client)
- IMAP: `nodemailer` (supports IMAP transport, single dependency)
- Rationale: Official clients have best OAuth support; nodemailer covers IMAP without adding a second IMAP library

## Risks / Trade-offs

[Risk: OAuth token refresh complexity] → Mitigation: Use official SDKs' built-in token refresh; implement retry logic with exponential backoff
[Risk: IMAP credential security] → Mitigation: Encrypt credentials at rest using existing memory encryption; never log credentials
[Risk: Large attachment handling] → Mitigation: Stream large attachments; enforce size limits via config
[Risk: Provider API rate limits] → Mitigation: Implement client-side rate limiting; respect API headers
[Risk: Dependency bloat] → Mitigation: Only install providers that are configured; lazy-load provider modules

## Migration Plan

No migration needed — this is a new feature with no existing email code. The tools are opt-in: they only activate when email provider credentials are configured in `config.yaml`.

## Open Questions

1. Should draft auto-save be configurable (interval)?
2. What is the maximum attachment size limit?
3. Should email tools support thread/conversation grouping?